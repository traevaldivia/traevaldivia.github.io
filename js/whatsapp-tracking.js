// Registro de contactos en una hoja de Google, vía Apps Script.
//
// Minimización de datos (Ley 21.719): se guarda solo lo necesario para saber
// qué página y qué motivo traen contactos. NUNCA el nombre, el comentario ni
// el teléfono: eso vive solo en el chat de WhatsApp de Monserrat.
//
// La comuna es texto libre en el formulario y alguien podría escribir su
// dirección: a la hoja solo va una de las cuatro comunas de visita u «Otra».
// La fecha y la hora las pone el Apps Script, que además vuelve a validar
// cada campo contra una lista cerrada (google-apps-script.gs).
//
// Se envía con sendBeacon porque en móvil el clic navega a WhatsApp de
// inmediato y un fetch normal se cancelaría a medio camino.
(function () {
    'use strict';

    // PENDIENTE: pegar aquí la URL del Apps Script publicado.
    // Ver google-apps-script.gs y analytics-setup.md.
    var URL_HOJA = '';

    // Las mismas cuatro de tools/gen_comun.py (COMUNAS) y del Apps Script.
    var COMUNAS = ['San Bernardo', 'La Florida', 'Talagante', 'Padre Hurtado'];

    function sinTildes(texto) {
        return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }

    // «san bernardo, calle X 123» -> «San Bernardo»; «Maipú» -> «Otra»; «» -> «».
    function comunaParaLaHoja(texto) {
        var limpio = sinTildes(String(texto || '')).trim();
        if (!limpio) return '';
        for (var i = 0; i < COMUNAS.length; i++) {
            if (limpio.indexOf(sinTildes(COMUNAS[i])) !== -1) return COMUNAS[i];
        }
        return 'Otra';
    }

    function dispositivo() {
        var ancho = window.innerWidth;
        if (ancho <= 768) return 'Movil';
        if (ancho <= 1024) return 'Tablet';
        return 'Escritorio';
    }

    function registrar(datos) {
        if (!URL_HOJA) {
            if (window.creaLog) window.creaLog('lead no enviado: falta la URL del Apps Script', datos.origen);
            return;
        }
        // Sin consentimiento no se registra nada: el contacto sigue su curso
        // por WhatsApp igual, simplemente no queda anotado aquí.
        if (!(window.Consentimiento && window.Consentimiento.concedido())) return;

        var cuerpo = JSON.stringify({
            // El mismo valor que el «pagina» de GA4 (conversion-tracking.js):
            // lo define main.js. Si main.js no cargó, los dos van vacíos.
            pagina: window.creaPagina ? window.creaPagina() : '',
            dispositivo: dispositivo(),
            canal: datos.canal || 'whatsapp',
            origen: datos.origen || '',
            modalidad: datos.modalidad || '',
            motivo: datos.motivo || '',
            comuna: comunaParaLaHoja(datos.comuna)
        });

        try {
            // text/plain evita el preflight de CORS, que Apps Script no responde.
            var paquete = new Blob([cuerpo], { type: 'text/plain;charset=UTF-8' });
            if (navigator.sendBeacon && navigator.sendBeacon(URL_HOJA, paquete)) return;
            fetch(URL_HOJA, {
                method: 'POST', mode: 'no-cors', keepalive: true,
                headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: cuerpo
            }).catch(function () { /* que falle el registro no puede romper el contacto */ });
        } catch (e) {
            if (window.creaLog) window.creaLog('lead no enviado', e.message);
        }
    }

    window.CreaLeads = { registrar: registrar };
})();
