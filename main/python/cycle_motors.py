import Jetson.GPIO as GPIO
import time

# 
# setup
# 
if True:
    PWM_PIN = 33
    FREQ = 50 # Hz

    GPIO.setmode(GPIO.BOARD)
    GPIO.setup(PWM_PIN, GPIO.OUT)

    pwm = GPIO.PWM(PWM_PIN, FREQ)

    def set_pulse_width(duty_cycle_microseconds_delay):
        percent = (duty_cycle_microseconds_delay * FREQ) / 10000
        pwm.ChangeDutyCycle(percent)

    
    
    xavier_min_angle = 1000 # microseconds pulse width
    xavier_max_angle = 2000 # microseconds pulse width
    def angle_to_pulse_with(angle):
        # (0 to 360) to (1000 to 2000)
        return ((angle % 360/360)*1000)+1000

    prev_angle = 720
    def set_angle(angle):
        # not a big enough change
        if abs((angle - prev_angle) % 360) < 20:
            print(f'''overshooting to {angle+20}''')
            # overshoot, then back off
            set_pulse_width(angle_to_pulse_with(angle+20))
            
        set_pulse_width(angle_to_pulse_with(angle))
        


# 
# helpers
# 
def test_range():
    angle = 0
    degrees_of_change = 10
    while True:
        if angle + degrees_of_change > 360 or angle + degrees_of_change < 0:
            degrees_of_change = -degrees_of_change
        
        angle += degrees_of_change
        print(f'''angle = {angle}''')
        set_pulse_width(angle_to_pulse_with(angle))
        time.sleep(1)
try:
    pwm.start(0)
    while 1:
        angle = 110 # start 
        degrees_of_change = 1
        wait_time = 0.5 # sec
        while True:
            if angle + degrees_of_change > 200 or angle + degrees_of_change < 109:
                degrees_of_change = -degrees_of_change
            
            angle += degrees_of_change
            print(f'''angle = {angle}''')
            set_pulse_width(angle_to_pulse_with(angle))
            time.sleep(wait_time)
finally:
    pwm.stop()
    GPIO.cleanup()