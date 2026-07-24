import { sendMail } from "../email";

export async function sendApplicantEmail(to: string, companyName: string): Promise<void> {
  await sendMail({
    to,
    subject: "Bike-eco — Demande d'inscription reçue",
    text:
      `Bonjour,\n\nVotre demande d'inscription pour ${companyName} a bien été reçue. ` +
      `Elle est en attente de validation par notre équipe. Vous recevrez un email ` +
      `dès que votre compte sera activé.\n\nL'équipe Bike-eco`,
  });
}

export async function sendInviteEmail(to: string, code: string): Promise<void> {
  await sendMail({
    to,
    subject: "Bike-eco — Vous êtes invité",
    text:
      `Bonjour,\n\nVous avez été invité à rejoindre une entreprise sur Bike-eco. ` +
      `Ouvrez l'application, choisissez "J'ai un code d'invitation" et saisissez ce code :\n\n` +
      `    ${code}\n\nCe code est valable 1 heure.\n\nL'équipe Bike-eco`,
  });
}

export async function sendApprovalEmail(to: string, companyName: string): Promise<void> {
  await sendMail({
    to,
    subject: "Bike-eco — Votre compte est validé",
    text:
      `Bonjour,\n\nBonne nouvelle : le compte de ${companyName} a été validé par notre équipe. ` +
      `Vous pouvez dès à présent vous connecter à l'application pour vendre vos véhicules.\n\n` +
      `L'équipe Bike-eco`,
  });
}
