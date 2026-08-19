claude --resume a8a89977-82ec-4388-9581-ddd16e879f43

## Bike-eco app paths.

Bike-eco app has three distinct paths.

### First Path : Particuliers (B2C)

A non logued funnel where a customer can fill the B2C form and submit it to the Bike-eco team.
When submitted, two emails are sent :

- To Customer : An email to summarize the form he sent (relevant input fields), and additionnal information (to be provided)
- To Bike-eco : An email with all the information contained in the form (images + relevant input fields). Depending on which part of France it is (SOUTH or NORTH) the email will be sent to a different mailbox. During development phase, all emails are sent to rnoyer.dev@gmail.com

### Second Path : Concessionnaires/Garagistes (B2B)

After registration and Login, a customer will access a dashboard with all its sold and ongoing vehicules (called "dossier"), sorted in two differents categories :

- Dossiers en cours (submitted form, but negociation not started or still ongoing)
- Dossiers traités (submitted form and closed negociation)

On top of the dashboard, a button "Vendre une moto" which leads to the B2B form (slighlty different from B2C form).
Once submitted, the "dossier" appear in both customer dashboard and relevant bike-eco team member ("NORTH" or "SOUTH")

### Third Path : Back office

After registration and login, a buyer from Bike-eco team will access a dashboard with different features to manage submitted forms.
All B2B submitted cases are listed and sorted in 3 catégories :

- "Dossiers à traiter" (submitted form, but negociation not started)
- "Dossiers en cours" (submitted form, negociation still ongoing)
- "Dossiers traités" (submitted form and closed negociation)

#### Region filter

A Bike-eco team member can filter the dashboard dossiers by region. A "Région gérée"
dropdown in the back-office settings page selects which region's dossiers appear in the
dashboard:

- "Moitié Nord" — only `NORTH` dossiers
- "Moitié sud" — only `SOUTH` dossiers
- "Toute la France" — all dossiers (default)

The selected option is persisted locally and restored when the app is restarted. It
applies to every dossier section on the back-office dashboard ("Dossiers à traiter",
"Dossiers en cours", "Dossiers clos"). This filter is back-office only; B2B accounts do not see it.

## Chat feature

A chat is available for B2B logued account and the Bike-eco team to discuss further and send files such as photos and PDF.

- One distinct chat for each "dossier"
- Each chat message displays also : timestamp, sender name (Customer: '[customer name] - [company name]', Bike-eco team: '[Team member name] - Bike-eco')

## Dossier feature

Each Dossier is visible in the dashboard as a thin card. It contains the following infos :
On Bike-eco Team Dashboard :

- A thumbnail of the first photo uploaded by customer
- A text : [company name] - [customer name]
- A text :Form Field [Marque] or [Modele/Cylindré]

On B2B Customer dashboard :

- A thumbnail of the first photo uploaded by customer
- A text : Form Field [Marque] or [Modele/Cylindré]
- A text : Dossier status

When card is clicked, the Dossier page opens. It contains, from top to Bottom :

- Top section :
  - A Caroussel with all the photos
  - A badge on top right displaying the Dossier status
- Main section :
  - All the relevant form fields listed in a compact yet readable way.
- (optional feature) Bottom section :
  - A button to add non given previously information.

## Dossier management

- status
- price

## B2B Customer registration

### First registration (company + user)

When B2B customer registers, it gives the SIRET number and the company name.

- First user submit registration form (b2b-company-registration-form)
- Manually validated by Bike-eco team member
- Each user has the admin right to add someone else

### User registration for an existing company

- Existing user add the email address of the user to add
- The future user receive an email with a one-time, time limited registration link
- The future user click on link, it opens the app with the corresponding form (b2b-invited-registration-form)

## Bike-eco team registration

To be determined. Bike eco team should be able to add and delete members, and also recover accounts by themselves.
