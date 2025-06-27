# First three bytes are right side of the controller
# Second three bytes are left side of the controller
import serial
# default message = 238	252	227	250	188	225	254	254	254	254	254	254	254	254	254	254	238	0
# [35,138,146] # left side, max bottom left (3rd 4th 5th bytes)
# [238,252,227] # right side, neutral (1st 2nd 3rd bytes)
# [13,86,25] # right side, max top right 
# [50,47,25] # right side, max top left
# [50,79,122] # right side, max bottom left

ser = serial.Serial('/dev/cu.usbmodem1201', 115200) 

with open('output.txt', 'w') as f:
    while True:
        line = ser.readline().decode('utf-8', errors='ignore')
        print(line, end='')
        f.write(line.replace(' ', '\t'))