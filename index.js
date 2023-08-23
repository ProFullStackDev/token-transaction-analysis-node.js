const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const app = express();
const mainController = require("./controller/mainController");

app.use(express.static(__dirname + "/public"));
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true
}));

app.get("/home", (req, res) => {
	res.sendFile(`${__dirname}/public/index.html`);
});

app.get("/tx/:hash", mainController.test);

app.listen(3030, () => {
	console.log("Server started at 3030");
});