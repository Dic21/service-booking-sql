const express = require("express");
const app = express();
const port = 4000;

const mainRoute = require('./routes/mainRoute');
const serviceRoute = require('./routes/serviceRoute');

app.use(express.json());
app.use('/images', express.static('images'));
app.use(express.urlencoded({ extended: true }));

app.use('/', mainRoute);
app.use('/services', serviceRoute);

app.listen(port, () => {
    console.log(`Example app listening on port ${port}!`);

});
