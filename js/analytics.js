// Google Analytics 4 - carga diferida y con consentimiento previo
//
// Rendimiento: gtag es lo mas caro que carga una pagina estatica. Aqui no se
// toca hasta que el hilo principal esta libre y la persona ya acepto.
//
// Ley 21.719: sin consentimiento esta pagina no envia ni un dato a terceros.
// La decision se gestiona en consentimiento.js.
(function () {
    'use strict';

    // PENDIENTE: reemplazar por el ID real al crear la propiedad GA4.
    // Es el unico lugar del sitio donde aparece. Ver analytics-setup.md.
    var ID = 'G-XXXXXXXXXX';
    var ESPERA_MS = 2500;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

    var cargado = false;
    var eventos = ['pointerdown', 'click', 'keydown', 'touchstart', 'scroll'];

    function hayConsentimiento() {
        return !!(window.Consentimiento && window.Consentimiento.concedido());
    }

    // Los navegadores automatizados (Playwright, Lighthouse) ensucian las
    // metricas con sesiones falsas de las propias pruebas. La salida es una
    // marca sembrada a proposito en el perfil: no se puede activar desde una
    // URL ni desde un enlace, asi que ni un rastreador ni una visita
    // accidental la encienden.
    var MARCA_MEDICION = 'crea-medicion';

    function midiendoAProposito() {
        try { return localStorage.getItem(MARCA_MEDICION) === '1'; } catch (e) { return false; }
    }

    function esNavegadorAutomatizado() {
        return navigator.webdriver === true && !midiendoAProposito();
    }

    function dejarDeEscuchar() {
        eventos.forEach(function (e) { window.removeEventListener(e, alInteractuar); });
    }

    // Cuanto tardo la pagina en cargar. Va aqui y no en main.js porque gtag.js
    // descarta los eventos encolados antes del gtag('config'), y el config
    // ocurre segundos despues de load: desde main.js no llegaria nunca.
    function enviarTiempoDeCarga() {
        if (!('performance' in window)) return;
        var n = performance.getEntriesByType('navigation')[0];
        if (!n) return;
        var ms = Math.round(n.loadEventEnd - n.startTime);
        // loadEventEnd vale 0 si load aun no termino, y una navegacion traida
        // de la cache de retroceso no tiene tiempo de carga que contar.
        if (!(ms > 0)) return;
        window.gtag('event', 'page_load_time', { event_category: 'Rendimiento', value: ms });
    }

    function cargar() {
        if (cargado) return;
        if (esNavegadorAutomatizado()) { dejarDeEscuchar(); return; }
        if (!hayConsentimiento()) return;
        // El relleno es el prefijo seguido solo de X. No se busca una X suelta:
        // un ID real de GA4 puede llevarla. Tampoco se copia el relleno en otra
        // constante: el ID tiene que aparecer una sola vez (CLAUDE.md).
        if (/^X+$/.test(ID.slice(2))) {
            if (window.creaLog) window.creaLog('GA4 sin ID: no se carga gtag');
            dejarDeEscuchar();
            return;
        }
        cargado = true;
        dejarDeEscuchar();

        window.gtag('js', new Date());
        // Medición agregada, como dice la política de privacidad: sin Google
        // Signals (que cruza la visita con la cuenta de Google de la persona)
        // y sin señales de personalización de anuncios.
        window.gtag('config', ID, {
            allow_google_signals: false,
            allow_ad_personalization_signals: false
        });
        enviarTiempoDeCarga();

        var s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
        document.head.appendChild(s);
    }

    function alInteractuar() { cargar(); }

    // gtag.js descarta los eventos encolados antes de su gtag('config'). Quien
    // quiera medir una conversion llama primero a esto: asi el config ya ocurrio
    // cuando se empuja el evento. En la practica el pointerdown/keydown de mas
    // abajo ya lo habra cargado, pero un clic sintetico no dispara ninguno.
    window.CreaAnalytics = { asegurarCarga: cargar };

    // Tras load se espera a que el hilo principal este libre, para no competir
    // con el renderizado en moviles lentos.
    function programar() {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(cargar, { timeout: ESPERA_MS * 2 });
        } else {
            setTimeout(cargar, ESPERA_MS);
        }
    }

    eventos.forEach(function (e) {
        window.addEventListener(e, alInteractuar, { passive: true });
    });

    if (document.readyState === 'complete') setTimeout(programar, ESPERA_MS);
    else window.addEventListener('load', function () { setTimeout(programar, ESPERA_MS); });

    // Si acepta despues de cargada la pagina, se carga en ese momento
    document.addEventListener('consentimiento', function (e) {
        if (e.detail && e.detail.estado === 'concedido') cargar();
    });
})();
