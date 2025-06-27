#include <SPI.h>          //Library for using SPI Communication 
#include <mcp2515.h>      //Library for using CAN Communication (https://github.com/autowp/arduino-mcp2515/)

// 
// summary
// 
    // UART message
        // first byte is the motor number (0 to 3)
        // 128 is the max speed clockwise (set motor on table, look at it from the top down)
        // -128 is the max speed counter clockwise

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
    
    void setup() {
        while (!Serial);
        Serial.begin(SERIAL_BAUD_RATE);
        rate_limiter_last_call_time = millis();
        
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
    // // 
    // // receive from CANBUS
    // // 
    // if (mcp2515.readMessage(&canMsg) == MCP2515::ERROR_OK) {
    //     auto id      = canMsg.can_id;
    //     auto can_dlc = canMsg.can_dlc;
    
    //     Serial.print(" [id]:");
    //     Serial.print(id);
    //     Serial.print(" [can_dlc]:");
    //     Serial.print(can_dlc);
    //     Serial.print(" [angle1]:");
    //     Serial.print(canMsg.data[0]);
    //     Serial.print(" [angle2]:");
    //     Serial.print(canMsg.data[1]);
    //     Serial.print(" [rpm1]:");
    //     Serial.print(canMsg.data[2]);
    //     Serial.print(" [rpm2]:");
    //     Serial.print(canMsg.data[3]);
    //     Serial.print(" [current1]:");
    //     Serial.print(canMsg.data[4]);
    //     Serial.print(" [current2]:");
    //     Serial.print(canMsg.data[5]);
    //     Serial.print(" [6]:");
    //     Serial.print(canMsg.data[6]);
    //     Serial.print(" [7]:");
    //     Serial.print(canMsg.data[7]);
    //     Serial.print("\n");
    // }
    
    // 
    // send to CANBUS
    // 
    raw_outgoing_canbus_message.data[0] = 0;
    raw_outgoing_canbus_message.data[1] = 0;
    raw_outgoing_canbus_message.data[2] = 40; // 128 is the max speed counter clockwise from the top, 129 is max speed clockwise // 255 is zero speed
    raw_outgoing_canbus_message.data[3] = 0;
    raw_outgoing_canbus_message.data[4] = 0;
    raw_outgoing_canbus_message.data[5] = 0;
    raw_outgoing_canbus_message.data[6] = 0;
    raw_outgoing_canbus_message.data[7] = 0;
    mcp2515.sendMessage(&raw_outgoing_canbus_message);
    
    rate_limiter(CYCLE_TIME); // makes sure this loop always takes at least CYCLE_TIME milliseconds
}