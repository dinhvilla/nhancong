import admin from 'firebase-admin';

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
        const content = (data.content || "").trim().toUpperCase();
        const amount = data.transferAmount || 0;

        // Quét mã định danh thành viên NhanCong (Ví dụ: T925MN-955)
        const matchCode = content.match(/[A-Z][0-9]{3}[A-Z]{2}-[0-9]{3}/i);

        if (matchCode) {
            const memberCode = matchCode[0].toUpperCase();
            
            // TRỎ VÀO BẢNG RIÊNG NHÂN CÔNG ĐỂ KHÔNG XUNG ĐỘT VỚI SEEING.LOVE
            const userRef = db.collection("nhancong_users").doc(memberCode);
            const userDoc = await userRef.get();

            if (userDoc.exists) {
                let userData = userDoc.data();

                // Quy đổi: 1.000đ = 1 Point
                const addedPoints = Math.round(amount / 1000);
                const currentPoints = parseInt(userData.points) || 0;

                await userRef.update({
                    points: currentPoints + addedPoints,
                    updatedAt: new Date().toISOString()
                });

                return res.status(200).json({ success: true, message: "Cộng Point nhancong_users thành công" });
            }
        }

        return res.status(200).json({ success: true, message: "Không tìm thấy mã thành viên" });
    } catch (error) {
        console.error("Lỗi Webhook NhanCong:", error);
        return res.status(500).json({ error: error.message });
    }
}