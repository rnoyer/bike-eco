import { expect, test } from "@jest/globals";
import {
  companyRegisteredContent,
  dossierCreatedContent,
  motoLabel,
  newMessageContent,
  personFromSenderName,
  priceChangedContent,
  statusChangedContent,
} from "./copy";

test("motoLabel joins marque and modele", () => {
  expect(motoLabel({ marque: "Yamaha", modele: "MT-07" })).toBe("Yamaha MT-07");
});

test("motoLabel drops a missing half rather than leaving a stray space", () => {
  expect(motoLabel({ marque: "Yamaha", modele: "" })).toBe("Yamaha");
  expect(motoLabel({ marque: "", modele: "MT-07" })).toBe("MT-07");
});

test("motoLabel falls back when nothing was filled in", () => {
  expect(motoLabel({ marque: "", modele: "" })).toBe("Moto non renseignée");
  expect(motoLabel({})).toBe("Moto non renseignée");
});

test("personFromSenderName strips the trailing company", () => {
  expect(personFromSenderName("Camille Durand - Garage du Nord")).toBe(
    "Camille Durand",
  );
  expect(personFromSenderName("Lou Verdier - Bike-eco")).toBe("Lou Verdier");
});

test("personFromSenderName splits on the LAST separator", () => {
  // A company name may itself contain " - ".
  expect(personFromSenderName("Camille Durand - Moto - Sud")).toBe(
    "Camille Durand - Moto",
  );
});

test("personFromSenderName returns the whole string when there is no company", () => {
  expect(personFromSenderName("Camille Durand")).toBe("Camille Durand");
});

test("company registration copy", () => {
  expect(
    companyRegisteredContent({
      companyName: "Garage du Nord",
      createdByName: "Camille Durand",
    }),
  ).toEqual({
    title: "1 nouvelle entreprise s'est inscrite",
    body: "Garage du Nord\nCamille Durand",
  });
});

test("new dossier copy", () => {
  expect(
    dossierCreatedContent({
      companyName: "Garage du Nord",
      sellerName: "Camille Durand",
    }),
  ).toEqual({
    title: "Une nouvelle proposition d'achat vient d'être publié.",
    body: "Entreprise Garage du Nord\nVendeur : Camille Durand",
  });
});

test("a back-office recipient sees who sent the message", () => {
  expect(
    newMessageContent({ recipientRole: "backoffice", senderPerson: "Camille Durand", moto: "Yamaha MT-07" }),
  ).toEqual({
    title: "1 nouveau message de Camille Durand",
    body: "Pour la Yamaha MT-07",
  });
});

test("a b2b recipient always sees Bike-eco as the sender", () => {
  expect(
    newMessageContent({ recipientRole: "b2b", senderPerson: "Lou Verdier", moto: "Yamaha MT-07" }),
  ).toEqual({
    title: "1 nouveau message de Bike-eco",
    body: "Pour la Yamaha MT-07",
  });
});

test("status change copy uses the French label", () => {
  expect(
    statusChangedContent({
      recipientRole: "backoffice",
      moto: "Yamaha MT-07",
      status: "cloture",
    }),
  ).toEqual({
    title: "Le statut de la Yamaha MT-07 a évolué",
    body: "Nouveau statut: Clôturé",
  });
});

test("a b2b recipient is never told 'À traiter' — the back office's own state", () => {
  expect(
    statusChangedContent({
      recipientRole: "b2b",
      moto: "Yamaha MT-07",
      status: "a_traiter",
    }).body,
  ).toBe("Nouveau statut: En cours");
});

test("a back-office recipient does see 'À traiter'", () => {
  expect(
    statusChangedContent({
      recipientRole: "backoffice",
      moto: "Yamaha MT-07",
      status: "a_traiter",
    }).body,
  ).toBe("Nouveau statut: À traiter");
});

test.each(["en_cours", "cloture"] as const)(
  "both roles read the same label for %s",
  (status) => {
    const moto = "Yamaha MT-07";
    expect(statusChangedContent({ recipientRole: "b2b", moto, status })).toEqual(
      statusChangedContent({ recipientRole: "backoffice", moto, status }),
    );
  },
);

test("price change copy formats euros", () => {
  expect(
    priceChangedContent({ moto: "Yamaha MT-07", validatedPrice: 4200 }),
  ).toEqual({
    title: "Le prix validé de la Yamaha MT-07 a évolué",
    body: "Prix validé: 4200 €",
  });
});

test("a cleared price reads as a dash, never as 'null €'", () => {
  expect(
    priceChangedContent({ moto: "Yamaha MT-07", validatedPrice: null }),
  ).toEqual({
    title: "Le prix validé de la Yamaha MT-07 a évolué",
    body: "Prix validé: —",
  });
});

test("an unfilled vehicle still produces the fallback in every dossier string", () => {
  const moto = motoLabel({ marque: "", modele: "" });
  expect(
    statusChangedContent({ recipientRole: "backoffice", moto, status: "en_cours" })
      .title,
  ).toBe(
    "Le statut de la Moto non renseignée a évolué",
  );
});
