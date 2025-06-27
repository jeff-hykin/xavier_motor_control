// 
// parameters you can change
// 
    const int SERIAL_BAUD_RATE = 9600; // this is only for console output / debugging, doesn't matter too much
    const short int CYCLE_TIME = 1000; // milliseconds
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
    void setup() {
        while (!Serial);
        Serial.begin(SERIAL_BAUD_RATE);
        rate_limiter_last_call_time = millis();
    }

// 
// main code
// 
void loop() {
    Serial.print("Hello World!\n");
    rate_limiter(CYCLE_TIME); // makes sure this loop always takes at least CYCLE_TIME milliseconds
}