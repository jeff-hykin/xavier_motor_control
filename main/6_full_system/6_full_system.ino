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
    // Define RX and TX pins for software serial
    const int UART_SEND_RATE_LIMITER = 100; // milliseconds, NOTE: you need to keep this HIGH enough that whatever is receiving messages can keep up with the arduino
    const int UART_BAUD_RATE = 9600; // this is only for console output / debugging, doesn't matter too much
    const int UART_RX_PIN = 6 // green
    const int UART_TX_PIN = 7 // purple
    const int SERIAL_BAUD_RATE = 9600; // this is only for console output / debugging, doesn't matter too much
    const int PIN_FOR_MCP2515 = 10; // only change this if you need to change the wiring of the arduino for some reason
    const unsigned long DEBUGGING_PRINT_RATE_LIMITER = 500; // milliseconds
    const short int CYCLE_TIME = 50; // milliseconds NOTE(!!!): this needs to stay low, otherwise the motor does not respond (I'm unsure why)
// 
// parameters you probably DONT want to change
// 
    // many are based on the dji gm6020 datasheet: https://rm-static.djicdn.com/tem/17348/RM%20GM6020%20%E4%BD%BF%E7%94%A8%E8%AF%B4%E6%98%8E%EF%BC%88%E8%8B%B1%EF%BC%8920231103.pdf
    const short int OUTGOING_MESSAGE_ID_FOR_FIRST_FOUR_MOTORS = 0x1FF;  // NOTE: this value comes from the dji gm6020 datasheet
    const short int BYTES_PER_CANBUS_MESSAGE = 8;

// 
// helpers
// 
    struct UartMessageToMotor {
        uint8_t which_motor = 0;
        int8_t velocity = 0; // 128 is the max speed counter clockwise from the top
    } uart_message_to_motor;

    struct UartMessageFromMotor {
        int angle;
        int rpm;
        int current;
        uint8_t temperature;
    } uart_message_from_motor;
    
    const unsigned long timer_ForUart_duration = UART_SEND_RATE_LIMITER; // milliseconds
    unsigned long timer_ForUart_last_marker_time = 0;
    bool timer_ForUart_has_passed() {
        unsigned long current_time = millis();
        long long duration = current_time - timer_ForUart_last_marker_time;
        long long remaining_time_to_wait = duration - timer_ForUart_duration;
        return (remaining_time_to_wait > 0);
    }
    void timer_ForUart_reset() {
        timer_ForUart_last_marker_time = millis();
    }
    
    const unsigned long timer_ForPrint_duration = DEBUGGING_PRINT_RATE_LIMITER; // milliseconds
    unsigned long timer_ForPrint_last_marker_time = 0;
    bool timer_ForPrint_has_passed() {
        unsigned long current_time = millis();
        long long duration = current_time - timer_ForPrint_last_marker_time;
        long long remaining_time_to_wait = duration - timer_ForPrint_duration;
        return (remaining_time_to_wait > 0);
    }
    void timer_ForPrint_reset() {
        timer_ForPrint_last_marker_time = millis();
    }
    
    unsigned long rate_limiter_last_call_time = 0;
    void rate_limiter(unsigned int cycle_time_milliseconds) {
        unsigned long current_time = millis();
        long long duration = current_time - rate_limiter_last_call_time;
        long long remaining_time_to_wait = duration - cycle_time_milliseconds;
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
    struct can_frame can_msg;
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
    if (mcp2515.readMessage(&can_msg) == MCP2515::ERROR_OK) {
        
        if (debugging && timer_ForPrint_has_passed()) {
            auto id      = can_msg.can_id;
            auto can_dlc = can_msg.can_dlc;
            timer_ForPrint_reset();
            
            Serial.print(" [id]:");
            Serial.print(id);
            Serial.print(" [can_dlc]:");
            Serial.print(can_dlc);
            Serial.print(" [angle1]:");
            Serial.print(can_msg.data[0]);
            Serial.print(" [angle2]:");
            Serial.print(can_msg.data[1]);
            Serial.print(" [rpm1]:");
            Serial.print(can_msg.data[2]);
            Serial.print(" [rpm2]:");
            Serial.print(can_msg.data[3]);
            Serial.print(" [current1]:");
            Serial.print(can_msg.data[4]);
            Serial.print(" [current2]:");
            Serial.print(can_msg.data[5]);
            Serial.print(" [6]:");
            Serial.print(can_msg.data[6]);
            Serial.print(" [7]:");
            Serial.print(can_msg.data[7]);
            Serial.print("\n");
        }
        
        // 
        // send over uart
        // 
        if (timer_ForUart_has_passed()) {
            timer_ForUart_reset();
            
            // FIXME: switch this to use uart_message_from_motor
            
            // Send the struct as bytes
            byte* ptr = (byte*)&can_msg;
            for (unsigned int i = 0; i < sizeof(can_msg); i++) {
                uart.write(ptr[i]);
            }
        }
    }
    
    // 
    // read from uart if there is enough data
    // 
    if (uart.available() >= sizeof(UartMessageToMotor)) {
        byte* ptr = (byte*)&message_from_r;
        for (size_t i = 0; i < sizeof(UartMessageToMotor); i++) {
            ptr[i] = uart.read();
        }
        
        // mutate the continually-sent message
        raw_outgoing_canbus_message.data[uart_message_to_motor.which_motor*2] = -uart_message_to_motor.velocity;
        
        // FIXME: have a motor timeout or a heartbeat kind of thing as a saftey net
    }
    
    // 
    // tell motors to move
    // 
    mcp2515.sendMessage(&raw_outgoing_canbus_message);
    
    rate_limiter(CYCLE_TIME); // makes sure this loop always takes at least CYCLE_TIME milliseconds
}