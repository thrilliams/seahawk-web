import { Archive } from 'libarchive.js';
import loading from '../../components/loading/loading';
import dialogHelper from '../../components/dialogHelper/dialogHelper';
import keyboardnavigation from '../../scripts/keyboardNavigation';
import { appRouter } from '../../components/router/appRouter';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import * as userSettings from '../../scripts/settings/userSettings';
import { PluginType } from '../../types/plugin.ts';

import './style.scss';

// supported book file extensions
const FILE_EXTENSIONS = ['.cbr', '.cbt', '.cbz', '.cb7'];
// the comic book archive supports any kind of image format as it's just a zip archive
const IMAGE_FORMATS = ['jpg', 'jpeg', 'jpe', 'jif', 'jfif', 'jfi', 'png', 'avif', 'gif', 'bmp', 'dib', 'tiff', 'tif', 'webp'];

export class ComicsPlayer {
    constructor() {
        this.name = 'Comics Player';
        this.type = PluginType.MediaPlayer;
        this.id = 'comicsplayer';
        this.priority = 1;
        this.imageMap = new Map();

        this.onDialogClosed = this.onDialogClosed.bind(this);
        this.onWindowKeyDown = this.onWindowKeyDown.bind(this);
    }

    play(options) {
        this.currentPage = 0;
        this.pageCount = 0;

        const mediaSourceId = options.items[0].Id;
        this.comicsPlayerSettings = userSettings.getComicsPlayerSettings(mediaSourceId);

        const elem = this.createMediaElement();
        return this.setCurrentSrc(elem, options);
    }

    stop() {
        this.unbindEvents();

        const stopInfo = {
            src: this.item
        };

        Events.trigger(this, 'stopped', [stopInfo]);

        const mediaSourceId = this.item.Id;
        userSettings.setComicsPlayerSettings(this.comicsPlayerSettings, mediaSourceId);

        this.source?.release();

        const elem = this.mediaElement;
        if (elem) {
            dialogHelper.close(elem);
            this.mediaElement = null;
        }

        loading.hide();
    }

    destroy() {
        // Nothing to do here
    }

    currentTime() {
        return this.currentPage;
    }

    duration() {
        return this.pageCount;
    }

    currentItem() {
        return this.item;
    }

    volume() {
        return 100;
    }

    isMuted() {
        return false;
    }

    paused() {
        return false;
    }

    seekable() {
        return true;
    }

    onDialogClosed() {
        this.stop();
    }

    onDirChanged = () => {
        let langDir = this.comicsPlayerSettings.langDir;

        if (!langDir || langDir === 'ltr') {
            langDir = 'rtl';
        } else {
            langDir = 'ltr';
        }

        this.changeLanguageDirection(langDir);

        this.comicsPlayerSettings.langDir = langDir;
    };

    changeLanguageDirection(langDir) {
        const currentPage = this.currentPage;

        this.swiperInstance.changeLanguageDirection(langDir);

        const prevIcon = langDir === 'ltr' ? 'arrow_circle_left' : 'arrow_circle_right';
        this.mediaElement.querySelector('.btnToggleLangDir > span').classList.remove(prevIcon);

        const newIcon = langDir === 'ltr' ? 'arrow_circle_right' : 'arrow_circle_left';
        this.mediaElement.querySelector('.btnToggleLangDir > span').classList.add(newIcon);

        const dirTitle = langDir === 'ltr' ? 'Right To Left' : 'Left To Right';
        this.mediaElement.querySelector('.btnToggleLangDir').title = dirTitle;

        this.reload(currentPage);
    }

    onViewChanged = () => {
        let view = this.comicsPlayerSettings.pagesPerView;

        if (!view || view === 1) {
            view = 2;
        } else {
            view = 1;
        }

        this.changeView(view);

        this.comicsPlayerSettings.pagesPerView = view;
    };

    changeView(view) {
        const currentPage = this.currentPage;

        this.swiperInstance.params.slidesPerView = view;
        this.swiperInstance.params.slidesPerGroup = view;

        const prevIcon = view === 1 ? 'devices_fold' : 'import_contacts';
        this.mediaElement.querySelector('.btnToggleView > span').classList.remove(prevIcon);

        const newIcon = view === 1 ? 'import_contacts' : 'devices_fold';
        this.mediaElement.querySelector('.btnToggleView > span').classList.add(newIcon);

        const viewTitle = view === 1 ? 'Double Page View' : 'Single Page View';
        this.mediaElement.querySelector('.btnToggleView').title = viewTitle;

        this.reload(currentPage);
    }

    reload(currentPage) {
        const effect = this.swiperInstance.params.effect;

        this.swiperInstance.params.effect = 'none';
        this.swiperInstance.update();

        this.swiperInstance.slideNext();
        this.swiperInstance.slidePrev();

        if (this.currentPage != currentPage) {
            this.swiperInstance.slideTo(currentPage);
            this.swiperInstance.update();
        }

        this.swiperInstance.params.effect = effect;
        this.swiperInstance.update();
    }

    onWindowKeyDown(e) {
        // Skip modified keys
        if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;

        const key = keyboardnavigation.getKeyName(e);
        if (key === 'Escape') {
            e.preventDefault();
            this.stop();
        }
    }

    bindMediaElementEvents() {
        const elem = this.mediaElement;

        elem?.addEventListener('close', this.onDialogClosed, { once: true });
        elem?.querySelector('.btnExit').addEventListener('click', this.onDialogClosed, { once: true });
        elem?.querySelector('.btnToggleLangDir').addEventListener('click', this.onDirChanged);
        elem?.querySelector('.btnToggleView').addEventListener('click', this.onViewChanged);
    }

    bindEvents() {
        this.bindMediaElementEvents();

        document.addEventListener('keydown', this.onWindowKeyDown);
    }

    unbindMediaElementEvents() {
        const elem = this.mediaElement;

        elem?.removeEventListener('close', this.onDialogClosed);
        elem?.querySelector('.btnExit').removeEventListener('click', this.onDialogClosed);
        elem?.querySelector('.btnToggleLangDir').removeEventListener('click', this.onDirChanged);
        elem?.querySelector('.btnToggleView').removeEventListener('click', this.onViewChanged);
    }

    unbindEvents() {
        this.unbindMediaElementEvents();

        document.removeEventListener('keydown', this.onWindowKeyDown);
    }

    createMediaElement() {
        let elem = this.mediaElement;
        if (elem) {
            return elem;
        }

        elem = document.getElementById('comicsPlayer');
        if (!elem) {
            elem = dialogHelper.createDialog({
                exitAnimationDuration: 400,
                size: 'fullscreen',
                autoFocus: false,
                scrollY: false,
                exitAnimation: 'fadeout',
                removeOnClose: true
            });

            const viewIcon = this.comicsPlayerSettings.pagesPerView === 1 ? 'import_contacts' : 'devices_fold';
            const dirIcon = this.comicsPlayerSettings.langDir === 'ltr' ? 'arrow_circle_right' : 'arrow_circle_left';

            elem.id = 'comicsPlayer';
            elem.classList.add('slideshowDialog');
            elem.innerHTML = `<div dir=${this.comicsPlayerSettings.langDir} class="slideshowSwiperContainer">
                                <div class="swiper-wrapper"></div>
                                <div class="swiper-button-next actionButtonIcon"></div>
                                <div class="swiper-button-prev actionButtonIcon"></div>
                                <div class="swiper-pagination"></div>
                            </div>
                            <div class="actionButtons">
                                <button is="paper-icon-button-light" class="autoSize btnToggleLangDir" tabindex="-1">
                                    <span class="material-icons actionButtonIcon ${dirIcon}" aria-hidden="true"></span>
                                </button>
                                <button is="paper-icon-button-light" class="autoSize btnToggleView" tabindex="-1">
                                    <span class="material-icons actionButtonIcon ${viewIcon}" aria-hidden="true"></span>
                                </button>
                                <button is="paper-icon-button-light" class="autoSize btnExit" tabindex="-1">
                                    <span class="material-icons actionButtonIcon close" aria-hidden="true"></span>
                                </button>
                            </div>`;

            dialogHelper.open(elem);
        }

        this.mediaElement = elem;

        const dirTitle = this.comicsPlayerSettings.langDir === 'ltr' ? 'Right To Left' : 'Left To Right';
        this.mediaElement.querySelector('.btnToggleLangDir').title = dirTitle;

        const viewTitle = this.comicsPlayerSettings.pagesPerView === 1 ? 'Double Page View' : 'Single Page View';
        this.mediaElement.querySelector('.btnToggleView').title = viewTitle;

        this.bindEvents();
        return elem;
    }

    setCurrentSrc(elem, options) {
        const item = options.items[0];
        this.item = item;
        this.streamInfo = {
            started: true,
            ended: false,
            item: this.item,
            mediaSource: {
                Id: item.Id
            }
        };

        loading.show();

        return Promise.all([
            ComicSource.constructAppropriateSource(this.item),
            // eslint-disable-next-line import/no-unresolved
            import('swiper/bundle'),
            // eslint-disable-next-line import/no-unresolved
            import('swiper/css/bundle')
        ])
            .then(async ([source, { Swiper }]) => {
                this.currentPage = options.startPositionTicks / 10000 || 0;

                this.source = source;
                const slides = await this.source.getSlides(this.currentPage);
                const renderSlide = this.source.renderSlide.bind(this.source);

                loading.hide();

                this.swiperInstance = new Swiper(elem.querySelector('.slideshowSwiperContainer'), {
                    direction: 'horizontal',
                    // loop is disabled due to the lack of Swiper support in virtual slides
                    loop: false,
                    zoom: {
                        minRatio: 1,
                        toggle: true,
                        containerClass: 'slider-zoom-container'
                    },
                    autoplay: false,
                    keyboard: {
                        enabled: true
                    },
                    preloadImages: true,
                    slidesPerView: this.comicsPlayerSettings.pagesPerView,
                    slidesPerGroup: this.comicsPlayerSettings.pagesPerView,
                    slidesPerColumn: 1,
                    initialSlide: this.currentPage,
                    navigation: {
                        nextEl: '.swiper-button-next',
                        prevEl: '.swiper-button-prev'
                    },
                    pagination: {
                        el: '.swiper-pagination',
                        clickable: true,
                        type: 'fraction'
                    },
                    // reduces memory consumption for large libraries while allowing preloading of images
                    virtual: {
                        slides,
                        cache: true,
                        renderSlide,
                        addSlidesBefore: 1,
                        addSlidesAfter: 1
                    }
                });

                // save current page & release unrendered pages when streaming
                this.swiperInstance.on('slideChange', () => {
                    this.currentPage = this.swiperInstance.activeIndex;
                    Events.trigger(this, 'pause');

                    const activeSlides = slides.slice(Math.max(0, this.currentPage - 1), this.currentPage + 2);
                    this.source.onSlidesChange(activeSlides);
                });
            });
    }

    canPlayMediaType(mediaType) {
        return (mediaType || '').toLowerCase() === 'book';
    }

    canPlayItem(item) {
        return item.Path && FILE_EXTENSIONS.some(ext => item.Path.endsWith(ext));
    }
}

class ComicSource {
    constructor(item) {
        this.item = item;
        this.apiClient = ServerConnections.getApiClient(item.ServerId);
    }

    static async constructAppropriateSource(item) {
        try {
            const apiClient = ServerConnections.getApiClient(item.ServerId);
            await apiClient.get(apiClient.getUrl('/System/ComicStreaming'));
            return new StreamingSource(item);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
            return new ArchiveSource(item);
        }
    }

    // eslint-disable-next-line no-empty-function
    async getSlides() {}

    // eslint-disable-next-line no-empty-function
    renderSlide() {}

    // eslint-disable-next-line no-empty-function
    release() {}

    // eslint-disable-next-line no-empty-function, @typescript-eslint/no-unused-vars
    onSlidesChange(activeSlides) {}
}

class ArchiveSource extends ComicSource {
    async getSlides() {
        Archive.init({
            workerUrl: appRouter.baseUrl() + '/libraries/worker-bundle.js'
        });

        const downloadUrl = this.apiClient.getItemDownloadUrl(this.item.Id);

        const res = await fetch(downloadUrl);
        if (!res.ok) {
            return;
        }

        const blob = await res.blob();
        const archive = await Archive.open(blob);
        await archive.extractFiles();

        // metadata files and files without a file extension should not be considered as a page
        const files = (await archive.getFilesArray()).filter((file) => {
            const name = file.file.name;
            const index = name.lastIndexOf('.');
            return index !== -1 && IMAGE_FORMATS.includes(name.slice(index + 1).toLowerCase());
        }).sort((a, b) => {
            if (a.file.name < b.file.name) {
                return -1;
            } else {
                return 1;
            }
        });

        this.objectUrls = [];
        for (const file of files) {
            /* eslint-disable-next-line compat/compat */
            const url = URL.createObjectURL(file.file);
            this.objectUrls.push(url);
        }

        return this.objectUrls;
    }

    renderSlide(slide) {
        return `<div class="swiper-slide">
    <div class="slider-zoom-container">
        <img src="${slide}" class="swiper-slide-img">
    </div>
</div>`;
    }

    release() {
        /* eslint-disable-next-line compat/compat */
        this.objectUrls.forEach(URL.revokeObjectURL);
    }
}

class StreamingSource extends ComicSource {
    async getSlides(currentSlide = 0) {
        this.objectUrls = {};

        const response = await this.apiClient.get(this.apiClient.getUrl(`/Items/${this.item.Id}/Pages`));
        const { pageCount } = await response.json();

        this.pageUrls = [];
        for (let i = 0; i < pageCount; i++) {
            this.pageUrls.push(this.apiClient.getUrl(`/Items/${this.item.Id}/Pages/${i}`));
        }

        await this.pageUrls[currentSlide];
        return this.pageUrls;
    }

    renderImage(zoomElt, objectUrl) {
        const imgElt = document.createElement('img');
        imgElt.className = 'swiper-slide-img';
        imgElt.src = objectUrl;
        zoomElt.appendChild(imgElt);
    }

    renderSlide(slide) {
        const slideElt = document.createElement('div');
        slideElt.className = 'swiper-slide';
        const zoomElt = document.createElement('div');
        zoomElt.className = 'slider-zoom-container';
        slideElt.appendChild(zoomElt);

        if (slide in this.objectUrls) {
            this.renderImage(zoomElt, this.objectUrls[slide]);
            return slideElt;
        }

        const spinnerElt = document.createElement('div');
        spinnerElt.setAttribute('dir', 'ltr');
        spinnerElt.className = 'docspinner mdl-spinner mdlSpinnerActive';
        spinnerElt.innerHTML = '<div class="mdl-spinner__layer mdl-spinner__layer-1"><div class="mdl-spinner__circle-clipper mdl-spinner__left"><div class="mdl-spinner__circle mdl-spinner__circleLeft"></div></div><div class="mdl-spinner__circle-clipper mdl-spinner__right"><div class="mdl-spinner__circle mdl-spinner__circleRight"></div></div></div><div class="mdl-spinner__layer mdl-spinner__layer-2"><div class="mdl-spinner__circle-clipper mdl-spinner__left"><div class="mdl-spinner__circle mdl-spinner__circleLeft"></div></div><div class="mdl-spinner__circle-clipper mdl-spinner__right"><div class="mdl-spinner__circle mdl-spinner__circleRight"></div></div></div><div class="mdl-spinner__layer mdl-spinner__layer-3"><div class="mdl-spinner__circle-clipper mdl-spinner__left"><div class="mdl-spinner__circle mdl-spinner__circleLeft"></div></div><div class="mdl-spinner__circle-clipper mdl-spinner__right"><div class="mdl-spinner__circle mdl-spinner__circleRight"></div></div></div><div class="mdl-spinner__layer mdl-spinner__layer-4"><div class="mdl-spinner__circle-clipper mdl-spinner__left"><div class="mdl-spinner__circle mdl-spinner__circleLeft"></div></div><div class="mdl-spinner__circle-clipper mdl-spinner__right"><div class="mdl-spinner__circle mdl-spinner__circleRight"></div></div></div>';
        zoomElt.appendChild(spinnerElt);

        this.apiClient.get(slide)
            .then(response => response.blob())
            .then(blob => {
                // eslint-disable-next-line compat/compat
                const objectUrl = URL.createObjectURL(blob);
                this.objectUrls[slide] = objectUrl;
                this.renderImage(zoomElt, objectUrl);
                spinnerElt.remove();
            });

        return slideElt;
    }

    release() {
        // eslint-disable-next-line compat/compat
        Object.values(this.objectUrls).forEach(URL.revokeObjectURL);
    }

    onSlidesChange(activeSlides) {
        for (const slide in this.objectUrls) {
            if (!activeSlides.includes(slide)) {
                URL.revokeObjectURL(this.objectUrls[slide]);
                delete this.objectUrls[slide];
            }
        }
    }
}

export default ComicsPlayer;
