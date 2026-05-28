require('dotenv').config();
const { startExpiredOnlineOrderedCleaner } = require('./src/utils/expiredOnlineOrderCleaner');

const app = require('./src/app');

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
    console.log(`URL: http://localhost:${PORT}`);
    console.log(`========================================\n`);

    startExpiredOnlineOrderedCleaner();
});