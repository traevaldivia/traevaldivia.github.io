// Consentimiento de analítica - Ley 21.719 (rige desde diciembre de 2026)
//
// La ley exige consentimiento previo, específico, informado y revocable para
// tratar datos personales con fines de analítica. Hasta que la persona acepte,
// no se carga Google Analytics ni se guarda nada suyo.
//
// Decisiones de diseño:
// - Aceptar y rechazar tienen el mismo peso visual: la ley pide que negarse sea
//   tan fácil como aceptar.
// - Un solo «Aceptar» cubre dos finalidades (Google Analytics y la hoja de
//   contactos), así que el banner nombra las dos.
// - El banner no tapa la barra de acción del móvil, que es la que trae los
//   contactos: se le cede el alto real del banner mientras está visible.
// - El banner no le roba el foco a quien ya está escribiendo o navegando.
// - La decisión se puede revisar desde la política de privacidad, y sigue
//   valiendo hasta que se tome la nueva.
//
// Se carga con defer y ANTES que analytics.js: los scripts diferidos corren en
// orden, así que el Consent Mode queda fijado antes de que nada le hable a
// Google. Nada de lo de aquí necesita correr antes de pintar.
(function () {
    'use strict';

    var CLAVE = 'crea-consentimiento-analitica';
    // Subir si cambian las finalidades o cómo se explican: obliga a volver a
    // preguntar. La 2 nombra la hoja de contactos, que la 1 callaba. La 3
    // acompaña la política v4: GA4 recibe el tema (dolencia) del botón tocado.
    var VERSION = 3;

    // Las páginas de /dolencias/, /zonas/ y /blog/ están un nivel más abajo.
    function rutaRaiz() {
        var profundidad = location.pathname.replace(/^\/+/, '').split('/').length - 1;
        return profundidad > 0 ? new Array(profundidad + 1).join('../') : '';
    }

    function leer() {
        try {
            var bruto = localStorage.getItem(CLAVE);
            if (!bruto) return null;
            var dato = JSON.parse(bruto);
            return dato && dato.version === VERSION ? dato : null;
        } catch (e) {
            return null; // almacenamiento bloqueado: se trata como «sin decisión»
        }
    }

    function guardar(estado) {
        try {
            localStorage.setItem(CLAVE, JSON.stringify({
                estado: estado, version: VERSION, fecha: new Date().toISOString()
            }));
        } catch (e) { /* sin almacenamiento, la decisión vale solo para esta visita */ }
    }

    var estadoActual = (leer() || {}).estado || 'sin decidir';

    function avisar() {
        document.dispatchEvent(new CustomEvent('consentimiento', {
            detail: { estado: estadoActual }
        }));
    }

    // Sin consentimiento vigente no puede quedar ninguna cookie de Google
    // Analytics, venga de donde venga (una visita anterior en la que se aceptó,
    // una decisión que se revisó y se dejó a medias...).
    function borrarCookiesDeAnalitica() {
        var dominio = location.hostname.replace(/^www\./, '');
        document.cookie.split(';').forEach(function (cookie) {
            var nombre = cookie.split('=')[0].trim();
            if (!/^_ga/.test(nombre)) return;
            ['/', location.pathname].forEach(function (ruta) {
                [dominio, '.' + dominio, ''].forEach(function (d) {
                    document.cookie = nombre + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=' +
                        ruta + (d ? '; domain=' + d : '');
                });
            });
        });
    }

    if (estadoActual !== 'concedido') borrarCookiesDeAnalitica();

    // Dónde estaba el foco antes de que el banner lo tomara, para devolverlo.
    var focoPrevio = null;

    function decidir(estado) {
        var veniaDeAceptar = estadoActual === 'concedido';
        estadoActual = estado;
        guardar(estado);
        if (window.gtag) {
            window.gtag('consent', 'update', {
                analytics_storage: estado === 'concedido' ? 'granted' : 'denied'
            });
        }
        quitarBanner();
        avisar();

        if (estado !== 'concedido') {
            borrarCookiesDeAnalitica();
            // Si Google Analytics llegó a cargarse en esta página, solo una
            // recarga lo saca de la memoria.
            if (veniaDeAceptar) location.reload();
        }
    }

    function devolverFoco() {
        var destino = focoPrevio && document.contains(focoPrevio) ? focoPrevio : null;
        focoPrevio = null;
        if (!destino) {
            // Nadie tenía el foco: se deja al comienzo del contenido y no en
            // <body>, para que el tabulador siga desde un sitio con sentido.
            destino = document.getElementById('contenido') || document.querySelector('main');
            if (destino && !destino.hasAttribute('tabindex')) destino.setAttribute('tabindex', '-1');
        }
        if (destino) destino.focus({ preventScroll: true });
    }

    function quitarBanner() {
        var b = document.getElementById('banner-consentimiento');
        if (!b) return;
        var teniaElFoco = b.contains(document.activeElement);
        b.remove();
        document.body.classList.remove('con-consentimiento');
        document.documentElement.style.removeProperty('--alto-consentimiento');
        if (teniaElFoco) devolverFoco();
    }

    function apartarFlotantes(banner) {
        document.documentElement.style.setProperty('--alto-consentimiento',
            banner.offsetHeight + 'px');
        document.body.classList.add('con-consentimiento');
    }

    function nadieTieneElFoco() {
        var activo = document.activeElement;
        return !activo || activo === document.body || activo === document.documentElement;
    }

    // pedido: true cuando la persona abrió el banner a propósito (desde la
    // política). Solo entonces se le lleva el foco y se anuncia como diálogo.
    // En la primera visita es una región con nombre que no roba el foco: el
    // lector de pantalla empieza por el contenido y «No, gracias» no aparece
    // con el halo como si ya estuviera elegido.
    function mostrarBanner(pedido) {
        if (document.getElementById('banner-consentimiento')) return;

        var politica = rutaRaiz() + 'politica-privacidad.html';
        var banner = document.createElement('div');
        banner.id = 'banner-consentimiento';
        banner.className = 'consentimiento';
        banner.setAttribute('role', pedido ? 'dialog' : 'region');
        banner.setAttribute('aria-labelledby', 'consentimiento-titulo');
        banner.setAttribute('aria-describedby', 'consentimiento-detalle');
        banner.innerHTML =
            '<div class="consentimiento__texto">' +
                '<p id="consentimiento-titulo"><strong>¿Me dejas medir las visitas?</strong></p>' +
                '<p id="consentimiento-detalle">Si aceptas, uso Google Analytics para ver qué ' +
                'páginas ayudan más y, cuando me escribes, anoto sin tu nombre desde qué página, ' +
                'tu comuna y el motivo. Si prefieres que no, el sitio funciona igual. ' +
                '<a href="' + politica + '">Cómo trato tus datos</a>.</p>' +
            '</div>' +
            '<div class="consentimiento__botones">' +
                '<button type="button" class="btn btn--linea" data-consentimiento="rechazado">No, gracias</button>' +
                '<button type="button" class="btn btn--linea" data-consentimiento="concedido">Aceptar</button>' +
            '</div>';

        banner.querySelectorAll('[data-consentimiento]').forEach(function (b) {
            b.addEventListener('click', function () { decidir(b.dataset.consentimiento); });
        });

        document.body.appendChild(banner);
        apartarFlotantes(banner);

        if (pedido) {
            focoPrevio = nadieTieneElFoco() ? null : document.activeElement;
            banner.querySelector('button').focus();
        }
    }

    // API para analytics.js, whatsapp-tracking.js y el botón de la política
    // (estado() también lo usan las pruebas de Playwright).
    window.Consentimiento = {
        estado: function () { return estadoActual; },
        concedido: function () { return estadoActual === 'concedido'; },
        // Vuelve a mostrar el banner sin tocar la decisión vigente: si la
        // persona se va sin elegir, sigue valiendo la que tenía.
        preguntarDeNuevo: function () { mostrarBanner(true); }
    };

    // Consent Mode v2: hasta que se decida, todo denegado
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {
        analytics_storage: estadoActual === 'concedido' ? 'granted' : 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        wait_for_update: 500
    });

    // Botón de la política de privacidad para revisar o cambiar la decisión
    function conectarBotonPolitica() {
        var boton = document.getElementById('cambiar-consentimiento');
        var etiqueta = document.getElementById('estado-consentimiento');
        if (!boton) return;

        var textos = {
            'concedido': 'Ahora mismo: aceptada.',
            'rechazado': 'Ahora mismo: rechazada.',
            'sin decidir': 'Ahora mismo: sin decidir.'
        };
        function pintar() { if (etiqueta) etiqueta.textContent = textos[estadoActual]; }
        pintar();
        document.addEventListener('consentimiento', pintar);
        boton.addEventListener('click', function () { window.Consentimiento.preguntarDeNuevo(); });
    }

    // Con defer el DOM ya está listo; sin defer (una página antigua en caché)
    // se espera a que lo esté.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', conectarBotonPolitica);
    } else {
        conectarBotonPolitica();
    }

    if (estadoActual === 'sin decidir') {
        // Sin prisa: el banner aparece cuando la página ya está usable
        var mostrar = function () { setTimeout(function () { mostrarBanner(false); }, 1200); };
        if (document.readyState === 'complete') mostrar();
        else window.addEventListener('load', mostrar);
    } else {
        avisar();
    }
})();
