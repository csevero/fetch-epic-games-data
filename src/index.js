import axios from 'axios';
import { config } from 'dotenv';
import { appendFileSync, existsSync, writeFileSync, rmSync } from 'fs';
import ora from 'ora';

config();

async function* getEpicGamesData() {
  let url =
    'https://www.epicgames.com/account/v2/payment/ajaxGetOrderHistory?sortDir=DESC&sortBy=DATE&locale=pt-BR';

  while (url) {
    const { data } = await axios.get(url, {
      headers: { cookie: process.env.COOKIE },
    });

    yield data.orders.map(order => ({
      name: order.items[0].description,
      price: order.items[0].amount,
      date: new Date(order.createdAtMillis).toLocaleDateString('pt-br'),
    }));

    if (!data.nextPageToken) break;

    if (url.includes('nextPageToken')) {
      url = url.replace(/(nextPageToken=)(.*)/, `$1${data.nextPageToken}`);
    } else {
      url = url.concat(`&nextPageToken=${data.nextPageToken}`);
    }
  }
}

function writeDataToCsv(contents) {
  const contentFormatted = contents
    .map(content => Object.values(content).join(';'))
    .join('\n');

  appendFileSync(`./src/assets/games-info.csv`, contentFormatted.concat('\n'));
}

(async () => {
  const spinner = ora();
  let gamesCount = 0;
  let gamesTotalPrice = 0;

  spinner.start('🤖 - Fetching your games');

  if (existsSync('./src/assets/games-info.csv')) {
    rmSync('./src/assets/games-info.csv');
  }

  writeFileSync('./src/assets/games-info.csv', 'Name;Price;Date\n');
  for await (let data of getEpicGamesData()) {
    writeDataToCsv(data);

    const pageTotalPrice = data.reduce((prev, cur) => Number(cur.price.replace('R$', '').replace(',', '.')) + prev, 0)

    gamesTotalPrice += pageTotalPrice;
    gamesCount += data.length;
    spinner.text = `🔎 - ${gamesCount} fetched`;
  }
  spinner.succeed(`✅ - ${gamesCount} fetched`);
  spinner.succeed(`✅ - Total price of your account R$ ${gamesTotalPrice.toFixed(2)}`);
})();
