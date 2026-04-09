/**
 * Lazy-load YouTube embeds: thumbnail + play until click, then inject iframe.
 */
(function () {
    function youtubeIdFromHref(href) {
        var m = String(href).match(/\/embed\/([^?&#/]+)/);
        return m ? m[1] : '';
    }

    function buildActivateSrc(href) {
        var u = new URL(href, 'https://www.youtube.com');
        u.searchParams.set('autoplay', '1');
        if (!u.searchParams.has('mute')) {
            u.searchParams.set('mute', '1');
        }
        var vid = youtubeIdFromHref(u.pathname + u.search);
        if (u.searchParams.get('loop') === '1' && vid) {
            u.searchParams.set('playlist', vid);
        }
        return u.toString();
    }

    function activate(btn) {
        var href = btn.getAttribute('data-embed-src');
        if (!href) {
            return;
        }
        var iframe = document.createElement('iframe');
        var cls = btn.getAttribute('data-iframe-class');
        if (cls === '') {
            /* keep classless */
        } else if (cls != null && cls !== '') {
            iframe.className = cls;
        } else {
            iframe.className = 'youtube-video';
        }
        iframe.title = btn.getAttribute('data-title') || 'YouTube video';
        iframe.setAttribute(
            'allow',
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
        );
        iframe.setAttribute('allowfullscreen', '');
        if (btn.getAttribute('data-frameborder') != null) {
            iframe.setAttribute(
                'frameborder',
                btn.getAttribute('data-frameborder') || '0'
            );
        }
        var st = btn.getAttribute('data-iframe-style');
        if (st) {
            iframe.setAttribute('style', st);
        }
        iframe.src = buildActivateSrc(href);
        btn.replaceWith(iframe);
    }

    function init() {
        document.querySelectorAll('.youtube-facade').forEach(function (btn) {
            btn.addEventListener('click', function () {
                activate(btn);
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
