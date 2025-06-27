#include <SPI.h>          //Library for using SPI Communication 
#include <mcp2515.h>      //Library for using CAN Communication (https://github.com/autowp/arduino-mcp2515/)
#include <DHT.h>          //Library for using DHT sensor 
 
#define DHTPIN 8
#define DHTTYPE DHT11
 
struct can_frame canMsg;
 
MCP2515 mcp2515(10);
 
DHT dht(DHTPIN, DHTTYPE);     //initilize object dht for class DHT with DHT pin with STM32 and DHT type as DHT11
 
 
void setup()
{
  while (!Serial);
  Serial.begin(9600);
  SPI.begin();               //Begins SPI communication
  dht.begin();               //Begins to read temperature & humidity sesnor value
 
  mcp2515.reset();
  mcp2515.setBitrate(CAN_1000KBPS, MCP_8MHZ); //Sets CAN at speed 500KBPS and Clock 8MHz
  mcp2515.setNormalMode();
}

void loop()
{
    // id %= 4;
    // txMessage->data[2 * id] = output >> 8;
    // txMessage->data[2 * id + 1] = output & 0xFF;
    
    canMsg.can_id  = 0x1FF;           //CAN id as 0x036
    canMsg.can_dlc = 8;               //CAN data length as 8
    canMsg.data[0] = h;               //Update humidity value in [0]
    canMsg.data[1] = t;               //Update temperature value in [1]
    canMsg.data[2] = 0x40;            //Rest all with 0
    canMsg.data[3] = 0x40;
    canMsg.data[4] = 0x00;
    canMsg.data[5] = 0x00;
    canMsg.data[6] = 0x00;
    canMsg.data[7] = 0x00;
 
    mcp2515.sendMessage(&canMsg);     //Sends the CAN message
    delay(1000);
}