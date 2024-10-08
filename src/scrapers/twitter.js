const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

const loadConfig = (path) => fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')) : {};

const configs = {
    ...loadConfig('config.default.json'),
    ...loadConfig('config.json'),
    twitterUsername: process.env.TWITTER_USERNAME,
    twitterPassword: process.env.TWITTER_PASSWORD
}

console.log(configs);

const urls = [
    ...configs.searchTerms.map((term) => `https://twitter.com/search?q=${encodeURIComponent(term)}&src=typed_query&f=live`),
]

if (!configs.twitterUsername || !configs.twitterPassword) {
    throw new Error('Please provide the TWITTER_USERNAME & TWITTER_PASSWORD environment variables; otherwise I cannot scrape!');
}

if (!urls) {
    throw new Error('Please provide either `searchTerms` or `urls` so I have something to scrape!');
}

async function clickElementBySelectorAndText(page, selector, text) {
    await page.evaluate(async (selector, text) => {
        Array.from(document.querySelectorAll(selector)).find(el => el.textContent.trim() === text).click();
    }, selector, text);
}

async function twitterlogIn(page) {
    await page.goto('https://twitter.com/login');
    await page.waitForSelector('input[autocomplete="username"]');
    await page.type('input[autocomplete="username"]', configs.twitterUsername);
    await clickElementBySelectorAndText(page, "div", configs.nextLabel);
    await page.waitForSelector('input[autocomplete="current-password"]');
    await page.type('input[autocomplete="current-password"]', configs.twitterPassword);
    await clickElementBySelectorAndText(page, "button[role='button']", configs.loginLabel);
    await page.waitForSelector('article[data-testid="tweet"]');
}

(async () => {
    const browser = await puppeteer.launch(configs.puppeteerLaunchOptions);
    const page = await browser.newPage();

    // Output console logs on terminal while evaluating in the browser
    page.on('console', (msg) => {
        if (msg.text().startsWith("!!!")) {
            console.log(msg.text().slice(4))
        }
    });

    await twitterlogIn(page);

    const seen = {}

    for (let i = 0; i < urls.length; i++) {
        await page.goto(urls[i]);
        await page.waitForSelector('article[data-testid="tweet"]');

        await page.evaluate(async (seen, configs) => {
            const curSearchSeen = {};
            const startedAtMillis = new Date().getTime();
            let lastNewTweetAt = null;

            while (Object.keys(curSearchSeen).length < configs.tweetsPerPage) {
                document.querySelectorAll('article[data-testid="tweet"]').forEach((tweetElement) => {
                    const url = Array.from(tweetElement.querySelectorAll("a")).find(obj => obj.href.includes("/status/")).href;

                    const hasISODateTime = Array.from(tweetElement.querySelectorAll('time')).find(el => el.getAttribute('datetime'));
                    if (!hasISODateTime) {
                        return; // No ISODateTime means it's an ad rather than a tweet
                    }

                    // Only scrape unscraped tweets
                    if (seen[url]) {
                        return;
                    }
                    seen[url] = true;
                    curSearchSeen[url] = true;
                    lastNewTweetAt = new Date();

                    let images = []
                    tweetElement.querySelectorAll('img').forEach((elem)=>{
                        let src = elem.getAttribute('src');
                        if(src.includes("/profile_images/") || src.includes("/emoji/"))
                            return;
                       images.push(elem.getAttribute('src'));
                    });

                    // Output new tweet
                    console.log("!!!", JSON.stringify({
                        link: url,
                        description: tweetElement.querySelector('div[dir="auto"]').textContent,
                        author: tweetElement.querySelector('div[data-testid="User-Name"] a').href,
                        date: tweetElement.querySelector('time').getAttribute('datetime'),
                        images: images
                    }, null, 2));

                })

                const nowMillis = new Date().getTime()

                // For the current url, it took longer than the timeout to scrape the first tweet
                if (!lastNewTweetAt && (nowMillis - startedAtMillis) / 1000 > configs.timeoutForFirstTweetScrapedSeconds) {
                    return;
                }

                // For the current url, it took longer than the timeout to scrape the next new tweet
                if (lastNewTweetAt && (nowMillis - lastNewTweetAt) / 1000 > configs.timeoutBetweenTweetsScrapedSeconds) {
                    return;
                }

                // Scroll & wait before scraping again
                window.scrollBy(0, configs.scrollByPixels);
                await new Promise((resolve) => {
                    setTimeout(resolve, configs.scrollCooldownMillis);
                });
            }
        }, seen, configs);
    }

    await browser.close();
})();