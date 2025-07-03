#include <SoftwareSerial.h> // needed for uart
#include <SPI.h>            // Library for using SPI Communication (needed for mcp2515)
#include <mcp2515.h>        // Library for using CAN Communication (https://github.com/autowp/arduino-mcp2515/)

// 
// summary
// 
    // UART message
        // first byte is the motor number (0 to 3)
        // 128 is the max speed clockwise (set motor on table, look at it from the top down)
        // -128 is the max speed counter clockwise
    // versioning
        // Used library   Version Path
        // SPI            1.0     $PROJECT/virkshop/temporary.ignore/long_term/home/Library/Arduino15/packages/arduino/hardware/avr/1.8.6/libraries/SPI
        // autowp-mcp2515 1.2.1   $PROJECT/subrepos/arduino-mcp2515

        // Used platform Version Path
        // arduino:avr   1.8.6   $PROJECT/virkshop/temporary.ignore/long_term/home/Library/Arduino15/packages/arduino/hardware/avr/1.8.6
        

// 
// parameters you can change
// 
    // FIXME: add a required heartbeat system as a saftey net
    const int32_t UART_BAUD_RATE = 115200; // this is really important for whoever is listening
    const int32_t UART_RX_PIN = 6; // green wire in tutorial/image
    const int32_t UART_TX_PIN = 7; // purple wire in tutorial/image
    const int32_t SERIAL_BAUD_RATE = 115200; // this is only for console output / debugging, doesn't matter too much
    const int32_t PIN_FOR_MCP2515 = 10; // blue wire in tutorial, only change this if you need to change the wiring of the arduino for some reason
    const uint32_t DEBUGGING_PRINT_RATE_LIMITER = 500; // milliseconds
    const int32_t MAX_CYCLE_TIME = 50; // NOTE(!!!): this needs to stay low, otherwise the motor does not respond (I'm unsure why), units = milliseconds
    const bool LOCKSTEP_MESSAGES = false;   // when true then a uart message is ALWAYS and ONLY sent immediately before listening for a message
                                            // This can makes things easier to process, but has the problem of re-sending messages
                                            // (as well as increased rates of dropped outgoing messages)
// 
// parameters you probably DONT want to change
// 
    // many are based on the dji gm6020 datasheet: https://rm-static.djicdn.com/tem/17348/RM%20GM6020%20%E4%BD%BF%E7%94%A8%E8%AF%B4%E6%98%8E%EF%BC%88%E8%8B%B1%EF%BC%8920231103.pdf
    const int32_t OUTGOING_MESSAGE_ID_FOR_FIRST_FOUR_MOTORS = 0x1FF;  // NOTE: this value comes from the dji gm6020 datasheet
    // TODO: upgrade the handling to support motors 0-7 (currently only 0-3)
    const int32_t BYTES_PER_CANBUS_MESSAGE = 8;

// 
// helpers
// 
    struct UartMessageToMotor {
        uint8_t which_motor = 0; // based on motor id
        int8_t velocity = 0; // 128 is the max speed clockwise looking down when the motor is flat on a table
        uint32_t uart_send_rate = 0; // miliseconds, max value: 4294967295 (49 days)
    } uart_message_to_motor;

    struct UartMessageFromMotor {
        uint32_t canbus_id;     // 
        uint8_t motor_id;       // corrisponds to which_motor, and is based on canbus_id
        uint8_t can_dlc;        // Data Length Code
        float angle;            // Combined from data[0] and data[1], degrees (0 to 360)
        int16_t rpm;            // Combined from data[2] and data[3] // positive = clockwise/counterclockwise seems to vary from motor to motor. Unsure why
        int16_t discharge_rate;        // Combined from data[4] and data[5] // positive when energy is being consumed
        uint8_t temperature;    // From data[6] // celsius
        uint32_t timestamp;
    } uart_message_from_motor;
    bool latest_message_has_been_sent = false;
    
    uint32_t timer_ForUart_duration = 10; // milliseconds, NOTE: this value here is just the inital value
                                          // this gets overwritten by the message send over uart
    uint32_t timer_ForUart_last_marker_time = 0;
    bool timer_ForUart_has_passed() {
        uint32_t current_time = millis();
        int64_t duration = current_time - timer_ForUart_last_marker_time;
        int64_t remaining_time_to_wait = duration - timer_ForUart_duration;
        return (remaining_time_to_wait > 0);
    }
    void timer_ForUart_reset() {
        timer_ForUart_last_marker_time = millis();
    }
    
    const uint32_t timer_ForPrint_duration = DEBUGGING_PRINT_RATE_LIMITER; // milliseconds
    uint32_t timer_ForPrint_last_marker_time = 0;
    bool timer_ForPrint_has_passed() {
        uint32_t current_time = millis();
        int64_t duration = current_time - timer_ForPrint_last_marker_time;
        int64_t remaining_time_to_wait = duration - timer_ForPrint_duration;
        return (remaining_time_to_wait > 0);
    }
    void timer_ForPrint_reset() {
        timer_ForPrint_last_marker_time = millis();
    }
    
    uint32_t rate_limiter_last_call_time = 0;
    void rate_limiter(uint32_t cycle_time_milliseconds) {
        uint32_t current_time = millis();
        int64_t duration = current_time - rate_limiter_last_call_time;
        int64_t remaining_time_to_wait = duration - cycle_time_milliseconds;
        if (remaining_time_to_wait > 0) {
            delay(remaining_time_to_wait);
        }
        rate_limiter_last_call_time = current_time;
    }
    
// 
// setup
// 
    SoftwareSerial uart1(UART_RX_PIN, UART_TX_PIN);
    MCP2515 mcp2515(PIN_FOR_MCP2515);
    struct can_frame raw_outgoing_canbus_message;
    struct can_frame raw_incoming_can_msg;
    void send_uart_message() {
        // Send the struct as bytes
        byte* ptr = (byte*)&uart_message_from_motor;
        for (uint32_t i = 0; i < sizeof(uart_message_from_motor); i++) {
            uart1.write(ptr[i]);
        }
    }
    void setup() {
        while (!Serial);
        Serial.begin(SERIAL_BAUD_RATE);
        uart1.begin(UART_BAUD_RATE);

        // timers
        timer_ForUart_last_marker_time = timer_ForPrint_last_marker_time = rate_limiter_last_call_time = millis();
        
        SPI.begin();
        
        mcp2515.reset();
        mcp2515.setBitrate(CAN_1000KBPS, MCP_8MHZ); 
        mcp2515.setNormalMode();
        
        raw_outgoing_canbus_message.can_id  = OUTGOING_MESSAGE_ID_FOR_FIRST_FOUR_MOTORS;
        raw_outgoing_canbus_message.can_dlc = BYTES_PER_CANBUS_MESSAGE;
    }
    

// 
// main code
// 
bool debugging = false;
void loop() {
    // 
    // receive from CANBUS
    // 
    if (mcp2515.readMessage(&raw_incoming_can_msg) == MCP2515::ERROR_OK && raw_incoming_can_msg.can_id != 0) {
        // update the latest message
        uart_message_from_motor.canbus_id      = raw_incoming_can_msg.can_id;
        uart_message_from_motor.motor_id       = raw_incoming_can_msg.can_id - 517; // IDK why this is true, but emperically its true
        uart_message_from_motor.can_dlc        = raw_incoming_can_msg.can_dlc;
        uint16_t angle                         = (raw_incoming_can_msg.data[0] << 8) | raw_incoming_can_msg.data[1]; // max angle:8191 min angle 0
        uart_message_from_motor.angle          = (float)angle * 0.0439506775729; // convert to degrees
        uart_message_from_motor.rpm            = (int16_t)(raw_incoming_can_msg.data[2] << 8) | raw_incoming_can_msg.data[3];
        uart_message_from_motor.discharge_rate = (int16_t)((raw_incoming_can_msg.data[4] << 8) | raw_incoming_can_msg.data[5]);
        uart_message_from_motor.temperature    = raw_incoming_can_msg.data[6];
        uart_message_from_motor.timestamp      = millis();
        latest_message_has_been_sent = false;
    }
    
    // 
    // (maybe) send over uart
    // 
    // note: latest_message_has_been_sent means we never send the same message twice
    if (!LOCKSTEP_MESSAGES && !latest_message_has_been_sent && timer_ForUart_has_passed()) {
        timer_ForUart_reset();
        if (debugging && timer_ForPrint_has_passed()) {
            uint32_t id     = raw_incoming_can_msg.can_id;  // sizeof = 4
            uint8_t can_dlc = raw_incoming_can_msg.can_dlc; // sizeof = 1
            timer_ForPrint_reset();
            
            Serial.print(" [id]:");
            Serial.print(id);
            Serial.print(" [can_dlc]:");
            Serial.print(can_dlc);
            Serial.print(" [angle1]:"); // higher order byte
            Serial.print(raw_incoming_can_msg.data[0]);
            Serial.print(" [angle2]:"); // lower order byte
            Serial.print(raw_incoming_can_msg.data[1]);
            Serial.print(" [.angle]:"); 
            Serial.print(uart_message_from_motor.angle);
            Serial.print(" [rpm1]:");  // higher order byte
            Serial.print(raw_incoming_can_msg.data[2]);
            Serial.print(" [rpm2]:"); // lower order byte
            Serial.print(raw_incoming_can_msg.data[3]);
            Serial.print(" [.rpm]:"); 
            Serial.print(uart_message_from_motor.rpm);
            Serial.print(" [discharge_rate1]:"); // higher order byte
            Serial.print(raw_incoming_can_msg.data[4]);
            Serial.print(" [discharge_rate2]:"); // lower order byte
            Serial.print(raw_incoming_can_msg.data[5]);
            Serial.print(" [.discharge_rate]:"); 
            Serial.print(uart_message_from_motor.discharge_rate);
            Serial.print(" [motor temp]:");
            Serial.print(raw_incoming_can_msg.data[6]);
            Serial.print(" [.timestamp]:");
            Serial.print(uart_message_from_motor.timestamp);
            Serial.print("\n");
        }
        send_uart_message();
    }
    
    // 
    // read from uart if there is enough data
    // 
    if (uart1.available() >= sizeof(UartMessageToMotor)) {
        byte* ptr = (byte*)&uart_message_to_motor;
        for (size_t i = 0; i < sizeof(UartMessageToMotor); i++) {
            ptr[i] = uart1.read();
        }
        // updating timing
        timer_ForUart_duration = uart_message_to_motor.uart_send_rate;
        // mutate the continually-sent message
        raw_outgoing_canbus_message.data[uart_message_to_motor.which_motor*2] = -uart_message_to_motor.velocity;
        
        if (LOCKSTEP_MESSAGES) {
            send_uart_message();
        }
    }
    
    // 
    // tell motors to move
    // 
    mcp2515.sendMessage(&raw_outgoing_canbus_message);
    
    rate_limiter(timer_ForUart_duration < MAX_CYCLE_TIME ? timer_ForUart_duration : MAX_CYCLE_TIME); // this makes sure each loop iteration takes at least MAX_CYCLE_TIME milliseconds
}