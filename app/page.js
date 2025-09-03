import { Zalo } from "zca-js";

const zalo = new Zalo({
    selfListen: false, // mặc định false, lắng nghe sự kiện của bản thân
    checkUpdate: true, // mặc định true, kiểm tra update
    logging: false // mặc định true, bật/tắt log mặc định của thư viện
});

export default async function App() {
    const api = await zalo.loginQR({}, (qrPath) => {
        console.log(`Quét mã tại ${qrPath} để đăng nhập`)
    });

    api.listener.start(); // bắt đầu lắng nghe sự kiện
    console.log(`Đã đăng nhập vào tài khoản ${api.getOwnId()}`)
}

// đăng nhập 2 tài khoản đồng thời
for (let i = 0; i < 2; i ++) {
    await App();
}