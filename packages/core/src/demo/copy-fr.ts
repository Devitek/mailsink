import type { DemoCopy } from './copy'

export const demoCopyFr: DemoCopy = {
  team: "L'équipe Fieldnote",
  footer: 'Fieldnote, 12 rue de l’Exemple, Lyon. Message de démo créé par Mailsink.',
  welcome: {
    subject: 'Bienvenue sur Fieldnote, Jeanne',
    paragraphs: [
      'Merci pour votre inscription. Confirmez votre adresse pour activer votre espace.',
      'Notre guide de démarrage vous accompagne dans votre premier projet en cinq minutes.',
    ],
    action: 'Confirmer mon adresse',
  },
  reset: {
    subject: 'Réinitialisez votre mot de passe',
    paragraphs: [
      'Une demande de réinitialisation du mot de passe de votre compte a été faite.',
      "Le lien ci-dessous est valable 30 minutes. Ignorez cet email si ce n'était pas vous.",
    ],
    action: 'Choisir un nouveau mot de passe',
  },
  invoice: {
    subject: 'Votre facture INV-2026-0142',
    paragraphs: [
      'Votre facture de novembre est jointe (PDF), avec le détail de consommation (CSV).',
      'Montant : 49,00 €, prélevé automatiquement le 1er décembre.',
    ],
    action: 'Voir mon historique de facturation',
    csvHeader: 'date,postes,montant',
  },
  shipped: {
    subject: 'Votre commande n° 4821 est expédiée',
    paragraphs: [
      'Bonne nouvelle : votre commande a quitté notre entrepôt ce matin.',
      'Livraison prévue sous 2 à 3 jours ouvrés.',
    ],
    action: 'Suivre mon colis',
  },
  digest: {
    subject: 'Votre résumé de la semaine : 3 nouveaux commentaires',
    paragraphs: [
      "Voici ce qui s'est passé dans vos projets cette semaine.",
      'Alex a commenté « Plan de lancement », Maria a répondu deux fois dans « Feuille de route T4 ».',
    ],
    action: 'Ouvrir Fieldnote',
  },
  signIn: {
    subject: 'Votre lien de connexion',
    paragraphs: ['Utilisez ce lien pour vous connecter. Il expire dans 10 minutes.'],
    action: 'Me connecter',
  },
  paymentFailed: {
    subject: 'Échec du paiement de votre abonnement',
    paragraphs: [
      "Nous n'avons pas pu débiter votre carte se terminant par 4242.",
      'Mettez à jour votre moyen de paiement pour garder votre espace actif.',
    ],
    action: 'Mettre à jour ma carte',
  },
  invite: {
    subject: 'Maria vous invite à rejoindre « Équipe design »',
    paragraphs: [
      "Maria Lopez vous invite à collaborer dans l'espace « Équipe design ».",
      "Acceptez l'invitation pour voir les projets partagés avec vous.",
    ],
    action: "Accepter l'invitation",
  },
}
