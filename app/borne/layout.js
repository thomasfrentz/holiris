// Si la page de la borne ne démarre pas (navigateur de tablette trop ancien, JavaScript bloqué),
// un petit script très simple remplace « Chargement… » par la marche à suivre au bout de 12 secondes.
const DIAGNOSTIC = `setTimeout(function () {
  if (window.__holirisBorne) return;
  var el = document.getElementById('borne-chargement');
  if (!el) return;
  el.innerHTML = '<strong style="color:#1F2A24;font-size:20px">La borne ne démarre pas sur ce navigateur.</strong><br><br>'
    + 'Sur la tablette, ouvrez le Play Store et mettez à jour <strong>Android System WebView</strong> et <strong>Chrome</strong>, '
    + 'puis redémarrez la tablette.<br><br>Toujours bloqué ? Envoyez une photo de cet écran à thomas.frentz@holiris.fr.<br><br>'
    + '<span style="font-size:12px;color:#9BB5AA">' + navigator.userAgent.replace(/</g, '') + '</span>';
  el.style.maxWidth = '560px'; el.style.textAlign = 'center'; el.style.lineHeight = '1.6'; el.style.color = '#6F7C75';
}, 12000);`

export default function BorneLayout({ children }) {
  return (
    <>
      {children}
      <script dangerouslySetInnerHTML={{ __html: DIAGNOSTIC }} />
    </>
  )
}
