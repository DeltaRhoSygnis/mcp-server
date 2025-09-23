const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const WORKERS = parseInt(process.env.WORKERS) || numCPUs;

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);

  // Fork workers
  for (let i = 0; i < WORKERS; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork(); // Restart
  });

  // Primary handles load balancing (e.g., round-robin for WS sticky via proxy)
} else {
  // Workers run server
  require('./dist/index.js'); // Assume built; or use tsx watch src/index.ts in dev
  console.log(`Worker ${process.pid} started`);
}