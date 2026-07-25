import { expect, test } from "@jest/globals";
import { Timestamp } from "firebase/firestore";
import type { Message } from "@/lib/firestore/schema";
import { threadImageUrls } from "./threadImages";

function msg(urls: { type: "image" | "pdf"; url: string }[]): Message {
  return {
    senderId: "u1",
    senderName: "X",
    senderRole: "b2b",
    text: "",
    attachments: urls.map((a) => ({
      type: a.type,
      url: a.url,
      name: "n",
      size: 1,
    })),
    createdAt: Timestamp.now(),
  };
}

test("collects image URLs across the thread in order, excluding PDFs", () => {
  const messages = [
    msg([
      { type: "image", url: "a.jpg" },
      { type: "pdf", url: "d.pdf" },
    ]),
    msg([]),
    msg([
      { type: "image", url: "b.jpg" },
      { type: "image", url: "c.jpg" },
    ]),
  ];
  expect(threadImageUrls(messages)).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
});

test("no image attachments → empty list", () => {
  expect(threadImageUrls([msg([{ type: "pdf", url: "d.pdf" }])])).toEqual([]);
});
