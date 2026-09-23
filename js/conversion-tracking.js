// Eventos de conversion en GA4.
//
// Un solo listener delegado por tipo de evento: si cada boton tuviera el suyo,
// un CTA dentro de otro enlace mediria dos veces la misma accion.
//
// Los enlaces declaran su contexto en el HTML:
//   data-wa-origen="hero"   de donde salio el contacto
//   data-wa-servicio="..."  que servicio o dolencia lo origino. Va a GA4 tal
//                           cual, dolencia incluida: es el tema de la pagina,
//                           que ya viaja en page_location y en «pagina». Es
//                           contenido publico, no algo que la persona conto.
//                           Lo que si es suyo, el motivo que elige en el
//                           formulario, nunca va a GA4 (formulario-whatsapp.js).
//   data-no-medir           no medir este enlace (el respaldo del formulario:
//                           ese contacto ya se midió al enviar)
//
// Un doble clic en el mismo enlace se mide una vez. La navegacion nunca se
// bloquea: si la persona vuelve a tocar, WhatsApp o el telefono se abren igual.
//
// Nada de datos personales en los parametros.
(function () {
    'use strict';

    var yaEnviados = Object.create(null); // solo para eventos que no deben repetirse
    var VENTANA_REPETICION_MS = 1500;
    var ultimoClic = { href: '', momento: 0 };

    function medir(nombre, parametros) {
        if (window.CreaAnalytics) window.CreaAnalytics.asegurarCarga();
        if (window.gtag) window.gtag('event', nombre, parametros || {});
        if (window.creaLog) window.creaLog('evento', nombre, parametros);
    }

    function medirUnaVez(clave, nombre, parametros) {
        if (yaEnviados[clave]) return;
        yaEnviados[clave] = true;
        medir(nombre, parametros);
    }

    // Mismo valor que recibe la hoja (whatsapp-tracking.js): lo define main.js.
    function pagina() {
        return window.creaPagina ? window.creaPagina() : '';
    }

    // true si es el mismo enlace tocado hace menos de 1,5 s desde el ultimo
    // toque medido (doble clic o dedo nervioso). Solo evita medir dos veces;
    // los toques repetidos no reinician la ventana.
    function esRepeticion(href) {
        var ahora = Date.now();
        if (href === ultimoClic.href && ahora - ultimoClic.momento < VENTANA_REPETICION_MS) return true;
        ultimoClic = { href: href, momento: ahora };
        return false;
    }

    function contexto(el) {
        var fuente = el.closest('[data-wa-origen], [data-wa-servicio]') || el;
        return {
            ubicacion: fuente.getAttribute('data-wa-origen') || 'sin marcar',
            servicio: fuente.getAttribute('data-wa-servicio') || ''
        };
    }

    document.addEventListener('click', function (e) {
        var enlace = e.target.closest('a[href]');
        if (!enlace) return;
        var href = enlace.getAttribute('href') || '';
        var esWhatsApp = href.indexOf('wa.me') !== -1 || href.indexOf('api.whatsapp.com') !== -1;
        var esTelefono = href.indexOf('tel:') === 0;

        if (enlace.hasAttribute('data-no-medir')) return;
        if ((esWhatsApp || esTelefono) && esRepeticion(href)) return;
        var ctx = contexto(enlace);

        if (esWhatsApp) {
            medir('whatsapp_click', {
                ubicacion: ctx.ubicacion, servicio: ctx.servicio, pagina: pagina()
            });
            if (window.CreaLeads) {
                window.CreaLeads.registrar({ origen: ctx.ubicacion, motivo: ctx.servicio });
            }
            return;
        }
        if (esTelefono) {
            medir('telefono_click', { ubicacion: ctx.ubicacion });
            if (window.CreaLeads) {
                window.CreaLeads.registrar({ canal: 'telefono', origen: ctx.ubicacion });
            }
            return;
        }
        if (href.indexOf('instagram.com') !== -1) {
            medir('instagram_click', { ubicacion: ctx.ubicacion });
            return;
        }
        if (href.indexOf('maps.app.goo.gl') !== -1 || href.indexOf('google.com/maps') !== -1) {
            medir('mapa_click', { ubicacion: ctx.ubicacion });
        }
    });

    // Abrir una pregunta frecuente dice que duda tiene la gente. Se mide una
    // vez por pregunta: abrir y cerrar la misma no son dos intereses distintos.
    document.addEventListener('toggle', function (e) {
        var detalle = e.target;
        if (!detalle.matches || !detalle.matches('details')) return;
        if (!detalle.open) return;
        var resumen = detalle.querySelector('summary');
        var pregunta = resumen ? resumen.textContent.trim().slice(0, 90) : 'sin titulo';
        medirUnaVez('faq:' + pregunta, 'faq_abierta', { pregunta: pregunta });
    }, true); // toggle no burbujea: hay que escucharlo en captura

    // Llegar al 75% dice que la pagina se leyo de verdad.
    function alDesplazar() {
        var alto = document.documentElement.scrollHeight - window.innerHeight;
        if (alto <= 0) return;
        var recorrido = (window.scrollY || window.pageYOffset) / alto;
        if (recorrido < 0.75) return;
        medirUnaVez('scroll75', 'scroll_75', { pagina: pagina() });
        window.removeEventListener('scroll', alDesplazar);
    }
    window.addEventListener('scroll', alDesplazar, { passive: true });

    // Para que el formulario mida su propia conversion con las mismas reglas
    window.CreaMedicion = { evento: medir };
})();
