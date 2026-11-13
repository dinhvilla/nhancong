import admin from 'firebase-admin';

// Khởi tạo Firebase Admin SDK cho dự án NhanCong.net
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
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const data = req.body;
        const content = (data.content || "").trim().toUpperCase(); // Nội dung chuyển khoản
        const amount = data.transferAmount || 0; // Số tiền nạp

        // Quy tắc quét mã của Nhân Công: 1 Chữ cái + 3 Số + 2 Chữ cái + Dấu gạch ngang + 3 Số (Ví dụ: T925MN-955)
        const matchCode = content.match(/[A-Z][0-9]{3}[A-Z]{2}-[0-9]{3}/i);

        if (matchCode) {
            const memberCode = matchCode[0].toUpperCase();
            const userRef = db.collection("users").doc(memberCode);
            const userDoc = await userRef.get();

            if (userDoc.exists) {
                let userData = userDoc.data();

                // NẠP POINT (Quy đổi tự động: 1.000đ = 1 Point)
                const addedPoints = Math.round(amount / 1000);
                const currentPoints = parseInt(userData.points) || 0;

                await userRef.update({
                    points: currentPoints + addedPoints,
                    updatedAt: new Date().toISOString()
                });

                return res.status(200).json({ success: true, message: "Cộng Point NhanCong.net thành công" });
            }
        }

        return res.status(200).json({ success: true, message: "Không tìm thấy mã thành viên phù hợp" });
    } catch (error) {
        console.error("Lỗi Webhook NhanCong:", error);
        return res.status(500).json({ error: error.message });
    }
}