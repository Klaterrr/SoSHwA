#include <main.h>            // Header-file
#include <Servo.h>           // Library for Servo
#include <json/value.h>      // Library for parsing .json
#include <fstream>           // File Stream library

Servo DoorServo;

// Macross for turning {on/off} light
#define TurnOnOff ( NumLed, NumLedButton, i )                                             \
if ( digitalRead(NumLedButton, HIGH) || (Config["Sensors"][1][CurrentState][i]) )         \
{                                                                                         \
  digitalWrite(NumLed, HIGH)                                                              \
}                                                                                         \
else if ( digitalRead(NumLedButton, LOW) || !(Config["Sensors"][1][CurrentState][i]) )    \
{                                                                                         \
  digitalWrite(NumLed, LOW)                                                               \
}                                                                

void setup()
{
  DoorServo.attach(9);
  Serial.begin(9600);
  DoorServo.write(60);
  delay(1000);
  pinMode(FirstLed, OUTPUT);
  pinMode(FirstLedButton, INPUT);
  pinMode(SecondLed, OUTPUT);
  pinMode(SecondLedButton, INPUT);
}

void loop()
{
  ifstream ConfigFile("./config.json", ifstream::binary);
  ConfigFile >> Config;
  TurnOnOff(FirstLed, FirstLedButton, 0);
  TurnOnOff(SecondLed, SecondLedButton, 1);
  if (Serial.available() > 0)
  {
    State = Serial.read();
    Flag = 0;
  }
  // If the state is '0' the DC motor will turn off
  if (State == '0')
  {
    DoorServo.write(8);
    delay(1000);
    Serial.println("Door Locked");
  }
  else if (State == '1')
  {
    DoorServo.write(55);
    delay(1000);
    Serial.println("Door UnLocked");
  }
}