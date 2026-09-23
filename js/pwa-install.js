// Instalacion de la app y registro del service worker.
//
// La invitacion a instalar no interrumpe: es un boton discreto del pie que
// solo aparece si el navegador dice que se puede instalar.
(function () {
    'use strict';

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('/sw.js').then(function (reg) {
                if (window.creaLog) window.creaLog('service worker registrado', reg.scope);
            }).catch(function (e) {
                if (window.creaLog) window.creaLog('service worker no registrado', e.message);
            });
        });
    }

    var invitacion = null;

    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        invitacion = e;
        var boton = document.getElementById('instalar-app');
        if (!boton) return;
        boton.hidden = false;
        boton.addEventListener('click', function () {
            if (!invitacion) return;
            invitacion.prompt();
            invitacion.userChoice.then(function (resultado) {
                if (window.gtag) {
                    window.gtag('event', 'instalar_app', { resultado: resultado.outcome });
                }
                invitacion = null;
                boton.hidden = true;
            });
        }, { once: true });
    });

    window.addEventListener('appinstalled', function () {
        var boton = document.getElementById('instalar-app');
        if (boton) boton.hidden = true;
    });
})();
