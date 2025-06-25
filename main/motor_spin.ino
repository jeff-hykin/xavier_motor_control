#include <SPI.h>          //Library for using SPI Communication 
#include <mcp2515.h>      //Library for using CAN Communication (https://github.com/autowp/arduino-mcp2515/)

struct can_frame canMsg;
 
MCP2515 mcp2515(10);
 
 
void setup()
{
  while (!Serial);
  Serial.begin(9600);
  SPI.begin();               //Begins SPI communication
 
  mcp2515.reset();
  mcp2515.setBitrate(CAN_1000KBPS, MCP_8MHZ); 
  mcp2515.setNormalMode();
}

short int val = 0;
void loop()
{
  
    // id %= 4;
    // txMessage->data[2 * id] = output >> 8;
    // txMessage->data[2 * id + 1] = output & 0xFF;
    val;
    canMsg.can_id  = 0x1FF;           //CAN id as 0x036
    canMsg.can_dlc = 8;               //CAN data length as 8
    canMsg.data[0] = val;               //Update humidity value in [0]
    canMsg.data[1] = val;               //Update temperature value in [1]
    canMsg.data[2] = val;            //Rest all with 0
    canMsg.data[3] = val;
    canMsg.data[4] = val;
    canMsg.data[5] = val;
    canMsg.data[6] = val;
    canMsg.data[7] = val;
    Serial.print("sending");
    Serial.print(val);
    Serial.print("\n");
    mcp2515.sendMessage(&canMsg);     //Sends the CAN message
    delay(20);
}