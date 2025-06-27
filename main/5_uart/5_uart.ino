#include <SoftwareSerial.h>

// Define RX and TX pins for software serial
#define RX_PIN 6 // green
#define TX_PIN 7 // purple
#define BAUD_RATE 9600


// Create a SoftwareSerial object
SoftwareSerial uart1(RX_PIN, TX_PIN); // RX, TX

// 
// helpers
// 
    const unsigned long timer_ForPrint_duration = 500; // milliseconds
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

void setup() {
    Serial.begin(BAUD_RATE);        // Primary Serial for debugging
    uart1.begin(BAUD_RATE);      // SoftwareSerial for UART communication
    timer_ForPrint_last_marker_time = millis();

    Serial.println("Debug: Serial started");
    uart1.println("UART: Hello from SoftwareSerial!");
}

void loop() {
    // Check for data from software serial (external device)
    if (uart1.available()) {
        char c = uart1.read();
        Serial.print("got char from uart: ");
        Serial.print(c);
        Serial.print("\n");
        
    }
    
    if (timer_ForPrint_has_passed()) {
        timer_ForPrint_reset();
        uart1.print("hi from Arduino\n");
    }
    
    // read from stdin
    // if (Serial.available()) {
    //     char c = Serial.read();
    // }
}