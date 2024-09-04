const cheerio = require("cheerio");
const axios = require("axios");
const fs = require("fs");

const scrapedData = [];

const scrapeWebsite = async (url) => {
    try {
        const response = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0",
            },
        });
        const $ = cheerio.load(response.data);
        const topNews = $(".left-sidebar .left-part .other-article .content-txt h3")
            .toArray()
            .forEach((el) => {
                const element = $(el);
                const title = element.text();
                const link = element.find("a").attr("href");
                scrapedData.push({title, link});
            });
        console.log(scrapedData);a
        console.log("Length: ", scrapedData.length);

        fs.writeFileSync("output.json", JSON.stringify(scrapedData, null, 2));
    } catch (e) {
        console.log("Error fetching data");
    }
};

const url = "https://indianexpress.com/";
scrapeWebsite(url);