/** Landing page copy (#262, #271). Vietnamese by owner decision 2026-10-14; the rest of the app stays English. */
export const landingCopy = {
  shopName: "How About Me",
  headline: "Cộng đồng Threads nghĩ gì về bạn?",
  tagline: "Lắng nghe. Thấu hiểu.",
  explore: "Vào dashboard",
  wallLabel: "Các cụm từ được nhắc trên Threads, 30 ngày qua",
  legend: "Biển càng to, càng nhiều người nhắc. Màu biển là cảm xúc chủ đạo. Bấm vào biển để xem bài nhắc.",
  statsLabel: "30 ngày qua",
  stats: {
    mentions: "lượt nhắc · 30 ngày",
    positive: "tích cực",
    negative: "tiêu cực",
    lastUpdated: "cập nhật",
  },
  previous: (n: string) => `kỳ trước: ${n}`,
  neverSynced: "Chưa đồng bộ",
  emptyAdmin: "Thêm cụm từ cho landing trong Cài đặt",
  emptyOther: "Chưa có cụm từ nào được cấu hình.",
  sentiment: { positive: "tích cực", neutral: "trung tính", negative: "tiêu cực" },
  mentions: (n: string) => `${n} lượt nhắc`,
  noMentions: "chưa ai nhắc",
};
