import sys,time
import RPi.GPIO as GPIO
from twisted.internet import reactor
from twisted.python import log
from autobahn.websocket import WebSocketServerFactory, WebSocketServerProtocol, listenWS
from collections import deque

GPIO.setmode(GPIO.BOARD)

TRIG = 7
ECHO = 11

GPIO.setup(TRIG,GPIO.OUT)
GPIO.setup(ECHO,GPIO.IN)

class BroadcastServerProtocol(WebSocketServerProtocol):

    def onMessage(self, message,binary):
        if not binary:
            self.factory.broadcast("'%s' from %s" % (msg, self.peerstr))

    def onError(self,  error):
        print error

    def onOpen(self):
        self.factory.register(self)   

    def connectionLost(self, reason):
        WebSocketServerProtocol.connectionLost(self,reason)
        self.factory.unregister(self)     

    
class BroadcastServerFactory(WebSocketServerFactory):

    def __init__(self,url,debug=False,debugCodePaths=False):
        WebSocketServerFactory.__init__(self,url,debug=debug,debugCodePaths=debugCodePaths)
        self.clients = []
        self.sensorReadings = deque([])
        self.averageReading = 0
        self.oldAverageReading = 0
        self.tickcount = 0
        self.tick()

    def getSensorData(self):
        GPIO.output(TRIG,1)
        time.sleep(0.00001)
        GPIO.output(TRIG,0)

        while GPIO.input(ECHO) == 0:
            pass
        start = time.time()

        while GPIO.input(ECHO) == 1:
            pass
        stop = time.time()
        return (stop-start)*17000

    def getAverageReading(self,newReading):
        self.oldAverageReading = self.averageReading
        if len(self.sensorReadings) >= 5:
            self.sensorReadings.popleft()
        self.sensorReadings.append(newReading)
        for reading in self.sensorReadings:
            self.averageReading = self.averageReading + reading
        self.averageReading = self.averageReading/10
        return self.averageReading

    def getVelocity(self):
        return (self.averageReading - self.oldAverageReading)

    def tick(self):        
        self.broadcast('distance %s,velocity %s' % (self.getAverageReading(self.getSensorData()), self.getVelocity()) )
        reactor.callLater(0.15,self.tick)

    def register(self,client):
        if not client in self.clients:
            print "registered client "+ client.peerstr
            self.clients.append(client)

    def unregister(self,client):
        if client in self.clients:
            print "unregistered client" + client.peerstr
            self.clients.remove(client)

    def broadcast(self,msg):
        print "broadcasting '%s' .." % msg
        for c in self.clients:
            c.sendMessage(msg)
            print "msg sent to " + c.peerstr


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == 'debug':
        log.startLogging(sys.stdout)
        debug = True
    else:
        debug = False

    factory = BroadcastServerFactory("ws://localhost:3000", debug=debug)
    factory.protocol = BroadcastServerProtocol
    factory.setProtocolOptions(allowHixie76 = True)
    listenWS(factory)
    reactor.run()

  
 
