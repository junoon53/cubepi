
import sys
from twisted.internet import reactor
from autobahn.websocket import WebSocketClientFactory, \
                               WebSocketClientProtocol, \
                               connectWS


class BroadcastClientProtocol(WebSocketClientProtocol):
   """
   Simple client that connects to a WebSocket server, send a HELLO
   message every 2 seconds and print everything it receives.
   """

   def sendHello(self):
      self.sendMessage("Hello from Python!")
      reactor.callLater(2, self.sendHello)

   def onOpen(self):
      self.sendHello()

   def onMessage(self, msg, binary):
      print "Got message: " + msg


if __name__ == '__main__':

   if len(sys.argv) < 2:
      print "Need the WebSocket server address, i.e. ws://localhost:9000"
      sys.exit(1)

   factory = WebSocketClientFactory(sys.argv[1])
   factory.protocol = BroadcastClientProtocol
   connectWS(factory)

   reactor.run()