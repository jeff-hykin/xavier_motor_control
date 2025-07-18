#include <SPI.h>          //Library for using SPI Communication 
#include <mcp2515.h>      //Library for using CAN Communication (https://github.com/autowp/arduino-mcp2515/)

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
    const int SERIAL_BAUD_RATE = 9600; // this is only for console output / debugging, doesn't matter too much
    const short int CYCLE_TIME = 50; // milliseconds NOTE(!!!): this needs to stay low, otherwise the motor does not respond (I'm unsure why)
    const int PIN_FOR_MCP2515 = 10; // only change this if you need to change the wiring of the arduino for some reason
// 
// parameters you probably DONT want to change
// 
    // many are based on the dji gm6020 datasheet: https://rm-static.djicdn.com/tem/17348/RM%20GM6020%20%E4%BD%BF%E7%94%A8%E8%AF%B4%E6%98%8E%EF%BC%88%E8%8B%B1%EF%BC%8920231103.pdf
    const short int OUTGOING_MESSAGE_ID_FOR_FIRST_FOUR_MOTORS = 0x1FF;  // NOTE: this value comes from the dji gm6020 datasheet
    const short int BYTES_PER_CANBUS_MESSAGE = 8;

// 
// helpers
// 
    unsigned long timer_AA_duration = 10000; // milliseconds
    unsigned long timer_AA_last_marker_time = 0;
    bool timer_AA_has_passed() {
        unsigned long current_time = millis();
        long long duration = current_time - timer_AA_last_marker_time;
        long long remaining_time_to_wait = duration - timer_AA_duration;
        return (remaining_time_to_wait > 0);
    }
    void timer_AA_reset() {
        timer_AA_last_marker_time = millis();
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
    MCP2515 mcp2515(PIN_FOR_MCP2515);
    struct can_frame raw_outgoing_canbus_message;
    void setup() {
        while (!Serial);
        Serial.begin(SERIAL_BAUD_RATE);
        // timers
        timer_AA_last_marker_time = rate_limiter_last_call_time = millis();
        
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
int motor_id = 0;
void loop() {
    if (timer_AA_has_passed()) {
        motor_id++;
        if (motor_id > 3) {
            motor_id = 0;
        }
        timer_AA_reset();
        Serial.print("motor_id:");
        Serial.print(motor_id);
        Serial.print("\n");
    }
    
    // 
    // send to CANBUS
    // 
    raw_outgoing_canbus_message.data[0] = 0;
    raw_outgoing_canbus_message.data[1] = 0;
    raw_outgoing_canbus_message.data[2] = 0;
    raw_outgoing_canbus_message.data[3] = 0;
    raw_outgoing_canbus_message.data[4] = 0;
    raw_outgoing_canbus_message.data[5] = 0;
    raw_outgoing_canbus_message.data[6] = 0;
    raw_outgoing_canbus_message.data[7] = 0;
    
    raw_outgoing_canbus_message.data[motor_id*2] = 10;
    raw_outgoing_canbus_message.data[motor_id*2+1] = 10;
    mcp2515.sendMessage(&raw_outgoing_canbus_message);
    
    rate_limiter(CYCLE_TIME); // makes sure this loop always takes at least CYCLE_TIME milliseconds
}