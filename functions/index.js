const functions = require('firebase-functions');

exports.helloWorld = functions.https.onRequest((req, res) => {
    console.log(req.method)
    res.send("Hello from Firebase!");
});
