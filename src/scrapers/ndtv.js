const cheerio = require("cheerio");
const axios = require("axios");
const fs = require("fs");

let data = [];

const scrapeWebsite = async (url) => {
    try {
        const response = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0",
            },
        });

        const $ = cheerio.load(response.data);
        const newsItems = $(".news_Itm").toArray();

        newsItems.map((news) => {
            if ($(news).hasClass("adBg")) {
                return;
            }

            const image = $(news).find(".news_Itm-img a img").attr("src");

            const content = $(news).find(".news_Itm-cont");
            const link = $(content).find(".newsHdng a").attr("href");
            const title = $(content).find(".newsHdng a").text().trim();
            const description = $(content).find(".newsCont").text().trim();

            let postedBy = $(content).find(".posted-by").text();
            const dateMatch = postedBy.match(/(\w+ \w+ \d{2}, \d{4})/);
            let date = dateMatch ? dateMatch[0] : "";

            let location = "";
            if (dateMatch) {
                let postDateText = postedBy.split(dateMatch[0])[1];
                if (postDateText) {
                    location = postDateText.split(",").pop().trim();
                    location = location.replace(/[()]/g, "");
                }
            }

            if (title !== "" && link !== undefined && description !== "" && date !== "") {
                const newsItem = {image, title, link, description, date, location};
                data.push(newsItem);
            }
        });
    } catch (e) {
        console.log("Error fetching data from URL:", url);
    }
};

const scrapeAllPages = async () => {
    for (let i = 1; i <= 8; i++) {
        const url = `https://www.ndtv.com/latest/page-${i}`;
        await scrapeWebsite(url);
    }

    const finalData = {
        count: data.length,
        news: data,
    };

    fs.writeFileSync("ndtvScrapedData.json", JSON.stringify(finalData, null, 2));
    console.log("Scraping complete. Data saved to ndtvScrapedData.json");
};

scrapeAllPages();
