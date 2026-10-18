/**
 * Sentence bank for the demo seed (#294): Vietnamese / English snippets per topic and sentiment, plus the key phrases
 * an analysis of that snippet would extract (already normalised per BR-041). Fictional content — no real users.
 */
import type { TopicLabel } from "@how-about-me/taxonomy";

export type DemoSentiment = "positive" | "neutral" | "negative";
export type DemoLang = "vi" | "en";

export type TopicEntry = {
  topic: TopicLabel;
  /** Normalised key phrases (BR-041) that analyses of this topic may carry. */
  phrases: readonly string[];
  text: Record<DemoLang, Record<DemoSentiment, readonly string[]>>;
};

export const TOPIC_BANK: readonly TopicEntry[] = [
  {
    topic: "ticket",
    phrases: ["vé", "mở bán vé", "săn vé", "hết vé"],
    text: {
      vi: {
        positive: ["săn vé fan meeting mượt ghê, 5 phút là xong", "mở bán vé lần này nhanh, không bị văng"],
        neutral: ["mai mấy giờ mở bán vé vậy mọi người?", "vé hạng B còn không ạ"],
        negative: ["săn vé fan meeting mà web treo cả tiếng, hết vé luôn", "vừa vào đã hết vé, quá thất vọng"],
      },
      en: {
        positive: ["got my fan meeting tickets in minutes, smooth"],
        neutral: ["what time do tickets go on sale tomorrow?"],
        negative: ["tickets sold out while the page was still loading"],
      },
    },
  },
  {
    topic: "queue",
    phrases: ["xếp hàng", "check-in", "hàng chờ"],
    text: {
      vi: {
        positive: ["check-in bằng QR nhanh, không phải xếp hàng lâu", "hàng chờ online chạy đều, ổn áp"],
        neutral: ["check-in mở cổng lúc mấy giờ ạ", "có cần in vé để check-in không mọi người"],
        negative: ["xếp hàng 2 tiếng ngoài nắng mới được check-in", "hàng chờ online đứng im ở số 9000"],
      },
      en: {
        positive: ["check-in with the QR code took a minute"],
        neutral: ["does check-in open two hours before the show?"],
        negative: ["queued two hours for check-in, terrible"],
      },
    },
  },
  {
    topic: "performance",
    phrases: ["âm thanh", "sân khấu", "fan meeting"],
    text: {
      vi: {
        positive: ["âm thanh đỉnh, sân khấu đẹp xỉu", "fan meeting tối qua cảm xúc quá trời"],
        neutral: ["fan meeting kéo dài khoảng 2 tiếng phải không", "setlist fan meeting có bài mới không ta"],
        negative: ["âm thanh bị rè suốt nửa đầu, tiếc ghê", "sân khấu bị che, ngồi khu C không thấy gì"],
      },
      en: {
        positive: ["the sound at the fan meeting was amazing"],
        neutral: ["how long is the fan meeting usually?"],
        negative: ["sound kept cutting out during the first half"],
      },
    },
  },
  {
    topic: "payment",
    phrases: ["hoàn tiền", "hoàn vé", "thanh toán"],
    text: {
      vi: {
        positive: ["hoàn tiền về ví sau 2 ngày, nhanh hơn mình nghĩ", "thanh toán qua ví điện tử ok, có hoá đơn liền"],
        neutral: ["hoàn vé thì mất mấy ngày vậy ạ", "thanh toán thẻ quốc tế được không mọi người"],
        negative: ["hoàn vé 2 tuần chưa thấy tiền đâu", "bị trừ tiền 2 lần mà chưa được hoàn tiền"],
      },
      en: {
        positive: ["eventista refund arrived in two days, nice"],
        neutral: ["how long does an eventista refund take?"],
        negative: ["still waiting for my eventista refund after two weeks"],
      },
    },
  },
  {
    topic: "merchandise",
    phrases: ["lightstick", "merch", "photocard"],
    text: {
      vi: {
        positive: ["lightstick #lightstick đồng bộ màu đẹp lắm", "nhận merch đúng hẹn, photocard xinh"],
        neutral: ["lightstick có bán tại quầy không hay chỉ online", "merch giao trước hay nhận tại sự kiện ạ"],
        negative: ["lightstick #lightstick không kết nối được app", "merch giao thiếu photocard, chán"],
      },
      en: {
        positive: ["the #lightstick sync looked stunning"],
        neutral: ["can we buy the lightstick at the venue?"],
        negative: ["my #lightstick would not pair with the app"],
      },
    },
  },
  {
    topic: "customer_service",
    phrases: ["chăm sóc khách hàng", "hotline", "phản hồi"],
    text: {
      vi: {
        positive: ["chăm sóc khách hàng phản hồi nhanh, dễ thương", "hotline gọi phát được ngay"],
        neutral: ["hotline làm việc tới mấy giờ vậy", "inbox fanpage thì bao lâu có phản hồi"],
        negative: ["gọi hotline 10 lần không ai nghe", "chăm sóc khách hàng trả lời cho có"],
      },
      en: {
        positive: ["support replied within an hour, appreciated"],
        neutral: ["is there a hotline for ticket issues?"],
        negative: ["support never answered my emails"],
      },
    },
  },
  {
    topic: "membership",
    phrases: ["ứng dụng", "tài khoản", "membership"],
    text: {
      vi: {
        positive: ["ứng dụng bản mới mượt hơn hẳn", "membership được ưu tiên mua vé sớm, đáng tiền"],
        neutral: ["đăng ký membership ở đâu vậy mọi người", "ứng dụng có bản cho iPad không"],
        negative: ["ứng dụng cứ đăng xuất tài khoản liên tục", "membership trả tiền mà không được ưu tiên gì"],
      },
      en: {
        positive: ["the new app version is much smoother"],
        neutral: ["where do I sign up for membership?"],
        negative: ["the app keeps logging me out of my account"],
      },
    },
  },
  {
    topic: "venue",
    phrases: ["địa điểm", "gửi xe", "chỗ ngồi"],
    text: {
      vi: {
        positive: ["địa điểm rộng, gửi xe tiện", "chỗ ngồi thoải mái, nhìn rõ sân khấu"],
        neutral: ["địa điểm năm nay vẫn ở nhà thi đấu cũ hả", "gửi xe ở đâu gần nhất ạ"],
        negative: ["gửi xe 50k mà còn phải đi bộ xa", "chỗ ngồi chật, quạt không có"],
      },
      en: {
        positive: ["great venue, easy parking"],
        neutral: ["is the venue the same as last year?"],
        negative: ["parking was a nightmare at the venue"],
      },
    },
  },
] as const;

/** Mentions that guarantee ≥ 1 base-query match per post (base queries: 1zone / eventista, keyword + tag). */
export const BRAND_MENTIONS: Record<DemoLang, readonly (readonly [string, number])[]> = {
  vi: [
    ["bên 1zone", 3],
    ["app 1zone", 2],
    ["#1zone", 2],
    ["eventista", 2],
    ["#eventista", 1],
    ["1zone với eventista", 1],
  ],
  en: [
    ["1zone", 2],
    ["#1zone", 1],
    ["eventista", 2],
    ["#eventista", 1],
  ],
};

export const OPENERS: Record<DemoLang, readonly string[]> = {
  vi: ["Ủa", "Trời ơi", "Mọi người ơi", "Thật sự là", "Hôm nay", "Cho hỏi", ""],
  en: ["Honestly,", "So", "PSA:", "Quick question:", ""],
};

/** Demo landing phrases (BR-042); every one appears in the bank above so the landing page lights up. */
export const DEMO_LANDING_TERMS = [
  "vé",
  "check-in",
  "xếp hàng",
  "âm thanh",
  "fan meeting",
  "hoàn tiền",
  "lightstick",
  "ứng dụng",
] as const;

export const USERNAMES = [
  "minh.anh.fan",
  "thao_nguyen",
  "baolam.99",
  "kpop.hcm",
  "linh.dang",
  "quoc.huy",
  "eventlover",
  "ngoc.tran",
  "hoang_yen",
  "tuan.le",
  "mai.pham",
  "fanclub.vn",
] as const;
