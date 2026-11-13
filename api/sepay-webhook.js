import admin from 'firebase-admin';

// Khởi tạo Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
        })
    });
}
const db = admin.firestore();

export default async function handler(req, res) {
    // Chỉ chấp nhận method POST từ SePay bắn sang
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const data = req.body;
        const content = (data.content || "").trim().toUpperCase(); // Nội dung chuyển khoản
        const amount = data.transferAmount || 0; // Số tiền nạp

        // 1. KIỂM TRA XEM CÓ PHẢI MÃ CỦA SEEING.LOVE KHÔNG (Bắt đầu bằng P hoặc V)
        const seeingLoveMatch = content.match(/[PV][0-9]{3}[BCDGHKLMNPQTUVY]{2}[0-9]{2}-[0-9]{3}/i);

        if (seeingLoveMatch) {
            const memberCode = seeingLoveMatch[0].toUpperCase();
            const userRef = db.collection("users").doc(memberCode);
            const userDoc = await userRef.get();

            if (userDoc.exists) {
                let userData = userDoc.data();
                
                // Xử lý gói VIP / HIDE của Seeing.love nếu có từ khóa
                if (content.includes("HIDE") || content.includes("VIP") || content.includes("TINHHOA")) {
                    let expDate = new Date();
                    expDate.setMonth(expDate.getMonth() + 1);
                    
                    await userRef.update({
                        isElite: true,
                        isHidden: content.includes("HIDE"),
                        hideExpireAt: content.includes("HIDE") ? expDate.toISOString() : null,
                        updatedAt: new Date().toISOString()
                    });
                } else {
                    // Nạp Point chuẩn cho Seeing.love (1.000đ = 1 Point)
                    const addedPoints = Math.round(amount / 1000);
                    const currentPoints = parseInt(userData.points) || 0;

                    await userRef.update({
                        points: currentPoints + addedPoints,
                        updatedAt: new Date().toISOString()
                    });
                }
                return res.status(200).json({ success: true, message: "Đã xử lý nạp cho Seeing.love thành công" });
            }
        }

        // 2. NẾU KHÔNG PHẢI P HOẶC V -> XỬ LÝ CHO NHÂN CÔNG (NhanCong.net)
        // Quy tắc mã Nhân Công: 1 Chữ cái + 3 Số + 2 Chữ cái + Dấu gạch ngang + 3 Số (Ví dụ: T925MN-955)
        const nhanCongMatch = content.match(/[A-Z][0-9]{3}[A-Z]{2}-[0-9]{3}/i);

        if (nhanCongMatch) {
            const memberCode = nhanCongMatch[0].toUpperCase();
            const userRef = db.collection("users").doc(memberCode);
            const userDoc = await userRef.get();

            if (userDoc.exists) {
                let userData = userDoc.data();

                // NẠP POINT CHO NHÂN CÔNG (Quy đổi tự động: 1.000đ = 1 Point)
                const addedPoints = Math.round(amount / 1000);
                const currentPoints = parseInt(userData.points) || 0;

                await userRef.update({
                    points: currentPoints + addedPoints,
                    updatedAt: new Date().toISOString()
                });

                return res.status(200).json({ success: true, message: "Đã xử lý cộng Point cho NhanCong.net thành công" });
            }
        }

        // Nếu nội dung chuyển khoản không khớp bất kỳ định dạng nào -> Bỏ qua an toàn
        return res.status(200).json({ success: true, message: "Giao dịch không khớp mã thành viên nào, đã bỏ qua." });

    } catch (error) {
        console.error("Lỗi Webhook chung:", error);
        return res.status(500).json({ error: error.message });
    }
}