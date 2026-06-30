import { redirect } from 'next/navigation';

/**
 * « Page Contact » a été fusionnée dans Paramètres du site → onglet « Contact ».
 * On conserve cette route pour ne pas casser les liens/favoris existants : elle
 * redirige désormais vers le nouvel emplacement.
 */
export default function ContactPageSettingsPage() {
  redirect('/admin/settings?s=contact');
}
