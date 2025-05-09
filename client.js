const net = require("net");
const fs = require("fs");
const path = require("path");

// array for storing packet
const packets = []
// array for storing initial packets sequence
const receivedSequence = []


function createBuffer(callType, sequence) {

  // Need to fix its size to 2 as setting its size to 1 does not return any data
  const buffer = Buffer.alloc(2)

  buffer.writeUInt8(callType, 0);

  if (callType === 2 && sequence) {
    buffer.writeUInt8(sequence, 1);
  }

  return buffer;
}

// function to create connection
function createConnection() {
  const socket = net.createConnection({
    port: 3000,
    host: "127.0.0.1"
  })
  return socket;
}

function parseData(data) {
  const symbol = data.toString("ascii", 0, 4);
  // buy or sell type
  const type = data.toString("ascii", 4, 5)
  const quantity = data.readInt32BE(5);
  const price = data.readInt32BE(9);
  const sequence = data.readInt32BE(13);

  return { symbol, type, quantity, price, sequence };
}

function fetchMissingPackets(missingSequence) {
  if (missingSequence.length === 0) return console.log('Received All Packets');

  const socket = createConnection()

  socket.on("connect", () => {
    missingSequence.forEach((sequence) => {
      const buffer = createBuffer(2, sequence)
      socket.write(buffer)
    })
  })

  let buffer = Buffer.alloc(0);

  /* Incrementing this count every time we successfully parse 
  a packet to close the connection when all the missing packets are fetched*/
  let count = 0;

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk])

    while (buffer.length >= 17) {
      const data = buffer.subarray(0, 17);
      buffer = buffer.subarray(17);

      const parsedData = parseData(data);

      packets.push(parsedData)

      // Incrementing count
      count++;

      if (count === missingSequence.length) {

        socket.end(() => {


          packets.sort((a, b) => a.sequence - b.sequence);

          try {
            fs.writeFileSync(
              path.join(__dirname, "output.json"),
              JSON.stringify(packets, null, 2),
              "utf-8"
            );
            console.log("✅ JSON file created successfully as output.json");
          }
          catch (e) {
            console.log("❌ Failed to write JSON file:", error.message);
          }

        })
      }
    }


  })

  // 
  socket.on("error", (err) => {
    console.log("Socket error:", err.message);
  });
}

function fetchInitial() {
  const socket = createConnection()

  socket.on("connect", () => {
    const buffer = createBuffer(1)

    socket.write(buffer)
  })

  let buffer = Buffer.alloc(0)

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk])

    while (buffer.length >= 17) {
      const data = buffer.subarray(0, 17);
      buffer = buffer.subarray(17);

      const parsedData = parseData(data);

      packets.push(parsedData)
      receivedSequence.push(parsedData.sequence)
    }
  })

  socket.on("close", () => {



    const missingSequence = []

    // taking the largest sequence from the sequence array
    const largestSequence = Math.max(...receivedSequence)


    // keeping i as 1 assuming sequence always starts from 1
    for (let i = 1; i < largestSequence; i++) {
      if (!receivedSequence.includes(i)) {
        missingSequence.push(i)
      }
    }



    fetchMissingPackets(missingSequence)
  })

  // 
  socket.on("error", (err) => {
    console.log("Socket error:", err.message);
  });

}

fetchInitial()



