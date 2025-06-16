import Jetson.GPIO as GPIO
import time

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

try:
    angle = 0
    change_amount = 10
    while True:
        if angle + change_angle > 360 or angle + change_angle < 0:
            change_amount = -change_amount
        
        angle += change_amount
        set_pulse_width(angle_to_pulse_with(angle))
        time.sleep(1)
finally:
    pwm.stop()
    GPIO.cleanup()