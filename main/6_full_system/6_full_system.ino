#include <SoftwareSerial.h> // needed for uart
#include <SPI.h>            // Library for using SPI Communication (needed for mcp2515)
#include <mcp2515.h>        // Library for using CAN Communication (https://github.com/autowp/arduino-mcp2515/)

// 
// versioning
// 
    // Used library   Version Path
    // SPI            1.0     $PROJECT/virkshop/temporary.ignore/long_term/home/Library/Arduino15/packages/arduino/hardware/avr/1.8.6/libraries/SPI
    // autowp-mcp2515 1.2.1   $PROJECT/subrepos/arduino-mcp2515

    // Used platform Version Path
    // arduino:avr   1.8.6   $PROJECT/virkshop/temporary.ignore/long_term/home/Library/Arduino15/packages/arduino/hardware/avr/1.8.6

// 
// parameters you can change
// 
    const int32_t UART_BAUD_RATE = 57600; // NOTE: high baud rates like 115200 can cause TONS of data corruption
    const int32_t UART_RX_PIN = 6; // green wire in tutorial/image
    const int32_t UART_TX_PIN = 7; // purple wire in tutorial/image
    const uint32_t HEARTBEAT_MAX_GAP = 500; // milliseconds, no message from source after this time gap will set all the motors to 0
    const int32_t SERIAL_BAUD_RATE = 115200; // this is only for console output / DEBUGGING, doesn't matter too much
    const int32_t PIN_FOR_MCP2515 = 10; // blue wire in tutorial, only change this if you need to change the wiring of the arduino for some reason
    const int32_t MAX_CYCLE_TIME = 50; // NOTE(!!!): this needs to stay low, otherwise the motor does not respond (I'm unsure why), units = milliseconds
    const bool LOCKSTEP_MESSAGES = false;   // when true then a uart message is ALWAYS and ONLY sent immediately before listening for a message
                                            // This can makes things easier to process, but has the problem of re-sending messages
                                            // (as well as increased rates of dropped outgoing messages)
    const bool DEBUGGING = true;
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
    uint32_t last_time_message_received_milliseconds = 0;
    bool heatbeat_was_already_lost = false;
    
    struct __attribute__((packed)) UartMessageToMotor {
        uint32_t magic_number = 0xDEADBEEF;
        uint8_t check_sum = 0;
        uint8_t which_motor = 0; // based on motor id
        int8_t power = 0; // 128 is the max speed clockwise looking down when the motor is flat on a table
        uint32_t uart_send_cycle_time = 0; // miliseconds, max value: 4294967295 (49 days)
    } uart_message_to_motor, uart_message_to_motor_checker;
    byte* uart_message_buffer = (byte*)&uart_message_to_motor_checker;
    byte* confirmed_uart_message_buffer = (byte*)&uart_message_to_motor;
    
    #define print_uart_message_to_motor(serial_line, uart_message) \
    {                                                         \
        serial_line.print("magic_number:");                   \
        serial_line.print(uart_message.magic_number);         \
        serial_line.print(" check_sum:");                     \
        serial_line.print(uart_message.check_sum);            \
        serial_line.print(" which_motor:");                   \
        serial_line.print(uart_message.which_motor);          \
        serial_line.print(" power:");                      \
        serial_line.print(uart_message.power);             \
        serial_line.print(" uart_send_cycle_time:");          \
        serial_line.print(uart_message.uart_send_cycle_time); \
    }                                                         

    uint8_t communication_corruption_detected = 0;
    struct __attribute__((packed)) UartMessageFromMotor {
        uint32_t canbus_id;     // 
        uint8_t can_dlc;        // Data Length Code
        float angle;            // Combined from data[0] and data[1], degrees (0 to 360)
        int16_t rpm;            // Combined from data[2] and data[3] // positive = clockwise/counterclockwise seems to vary from motor to motor. Unsure why
        int16_t discharge_rate;        // Combined from data[4] and data[5] // positive when energy is being consumed
        uint8_t temperature;    // From data[6] // celsius
        uint32_t timestamp;
    };
    
    UartMessageFromMotor uart_messages_from_motors[4];
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
        uart1.write(communication_corruption_detected);
        communication_corruption_detected = 0;
        // Send the struct as bytes
        byte* ptr = (byte*)&uart_messages_from_motors;
        for (uint32_t i = 0; i < sizeof(uart_messages_from_motors); i++) {
            uart1.write(ptr[i]);
        }
    }
    void setup() {
        while (!Serial);
        Serial.begin(SERIAL_BAUD_RATE);
        uart1.begin(UART_BAUD_RATE);

        // timers
        timer_ForUart_last_marker_time = rate_limiter_last_call_time = millis();
        
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
void loop() {
    auto loop_start_time = millis();
    // 
    // receive from CANBUS
    // 
    if (mcp2515.readMessage(&raw_incoming_can_msg) == MCP2515::ERROR_OK && raw_incoming_can_msg.can_id != 0) {
        uint8_t motor_id = raw_incoming_can_msg.can_id - 517; // IDK why this is true, but empirically its true
        // update the latest message
        uart_messages_from_motors[motor_id].canbus_id      = raw_incoming_can_msg.can_id;
        uart_messages_from_motors[motor_id].can_dlc        = raw_incoming_can_msg.can_dlc;
        uint16_t angle                                     = (raw_incoming_can_msg.data[0] << 8) | raw_incoming_can_msg.data[1]; // max angle:8191 min angle 0
        uart_messages_from_motors[motor_id].angle          = (float)angle * 0.0439506775729; // convert to degrees
        uart_messages_from_motors[motor_id].rpm            = (int16_t)(raw_incoming_can_msg.data[2] << 8) | raw_incoming_can_msg.data[3];
        uart_messages_from_motors[motor_id].discharge_rate = (int16_t)((raw_incoming_can_msg.data[4] << 8) | raw_incoming_can_msg.data[5]);
        uart_messages_from_motors[motor_id].temperature    = raw_incoming_can_msg.data[6];
        uart_messages_from_motors[motor_id].timestamp      = loop_start_time;
        latest_message_has_been_sent = false;
        
        if (DEBUGGING && rand()<0.08) {
            Serial.print(" [motor_id]:");
            Serial.print(motor_id);
            Serial.print(" [canbus_id]:");
            Serial.print(uart_messages_from_motors[motor_id].canbus_id);
            Serial.print(" [can_dlc]:");
            Serial.print(uart_messages_from_motors[motor_id].can_dlc);
            Serial.print(" [angle]:");
            Serial.print(uart_messages_from_motors[motor_id].angle);
            Serial.print(" [rpm]:");
            Serial.print(uart_messages_from_motors[motor_id].rpm);
            Serial.print(" [discharge_rate]:");
            Serial.print(uart_messages_from_motors[motor_id].discharge_rate);
            Serial.print(" [temperature]:");
            Serial.print(uart_messages_from_motors[motor_id].temperature);
            Serial.print(" [timestamp]:");
            Serial.print(uart_messages_from_motors[motor_id].timestamp);
            Serial.print("\n");
        }
    }
    
    // 
    // (maybe) send over uart
    // 
    // note: latest_message_has_been_sent means we never send the same message twice
    if (!LOCKSTEP_MESSAGES && !latest_message_has_been_sent && timer_ForUart_has_passed()) {
        timer_ForUart_reset();
        send_uart_message();
    }
    
    // 
    // read from uart if there is enough data
    // 
    check_for_uart_message: if (uart1.available() >= sizeof(UartMessageToMotor)) {
        uint8_t check_sum = 0;
        uint16_t byte_index = 0;
        while (byte_index < sizeof(uart_message_to_motor_checker)) {
            uart_message_buffer[byte_index] = uart1.read();
            if (byte_index+1==sizeof(uart_message_to_motor_checker.magic_number)) {
                if (uart_message_to_motor.magic_number != uart_message_to_motor_checker.magic_number) {
                    communication_corruption_detected += 1;
                    if (communication_corruption_detected == 0) { // wrap around 
                        communication_corruption_detected = 1; // ensure its always at least positive
                    }
                    
                    if (DEBUGGING) {
                        Serial.print("communication corruption detected, magic_number incorrect\n");
                    }
                    
                    // 
                    // shift a random number of bytes
                    // 
                    // see commit before this one for why shifting 1 byte down doesnt work
                    uint8_t bytes_to_eat = (rand() * sizeof(uart_message_to_motor_checker.magic_number));
                    while (bytes_to_eat-- > 0){
                        uart1.read();
                    }
                    
                    // try again
                    goto check_for_uart_message;
                }
            }
            // keep track of check_sum
            if (byte_index >= sizeof(uart_message_to_motor_checker.magic_number)+sizeof(uart_message_to_motor.check_sum)) {
                auto addition_amount = (int32_t)uart_message_buffer[byte_index];
                check_sum += addition_amount;
            }
            byte_index++;
        }
        if (check_sum != uart_message_to_motor_checker.check_sum) {
            communication_corruption_detected += 16;
            if (communication_corruption_detected == 0) { // wrap around 
                communication_corruption_detected = 16; // ensure its always at least positive
            }
            if (DEBUGGING) {
                Serial.print("communication corruption detected, check_sum incorrect\n");
            }
        } else {
            last_time_message_received_milliseconds = loop_start_time;
            uart_message_to_motor = uart_message_to_motor_checker;
            if (DEBUGGING) {
                print_uart_message_to_motor(Serial,uart_message_to_motor);
                Serial.print("\n");
            }
            timer_ForUart_duration = uart_message_to_motor.uart_send_cycle_time;
            // mutate the continually-sent message
            raw_outgoing_canbus_message.data[uart_message_to_motor.which_motor*2] = -uart_message_to_motor.power;
        }
        
        if (LOCKSTEP_MESSAGES) {
            send_uart_message();
        }
    }
    
    // 
    // heartbeat
    // 
    const bool heatbeat_lost = loop_start_time - last_time_message_received_milliseconds > HEARTBEAT_MAX_GAP;
    if (heatbeat_lost) {
        if (DEBUGGING && !heatbeat_was_already_lost) {
            Serial.print("heartbeat lost, halting\n");
        }
        // set power of all motors to 0
        raw_outgoing_canbus_message.data[0*2] = 0;
        raw_outgoing_canbus_message.data[1*2] = 0;
        raw_outgoing_canbus_message.data[2*2] = 0;
        raw_outgoing_canbus_message.data[3*2] = 0;
        heatbeat_was_already_lost = true;
    } else {
        heatbeat_was_already_lost = false;
    }
    
    // 
    // tell motors to move
    // 
    mcp2515.sendMessage(&raw_outgoing_canbus_message);
    
    rate_limiter(timer_ForUart_duration < MAX_CYCLE_TIME ? timer_ForUart_duration : MAX_CYCLE_TIME);
    // makes sure each loop iteration takes at least MAX_CYCLE_TIME milliseconds
}