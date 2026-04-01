import Box from '@mui/material/Box/Box';
import Fade from '@mui/material/Fade/Fade';
import React, { useRef, type FC, useEffect, useState } from 'react';

import SyncPlayButton from 'apps/experimental/components/AppToolbar/SyncPlayButton';
import AppToolbar from 'components/toolbar/AppToolbar';
import ViewManagerPage from 'components/viewManager/ViewManagerPage';
import { EventType } from 'constants/eventType';
import Events, { type Event } from 'utils/events';
import { playbackManager } from 'components/playback/playbackmanager';
import { BaseItemDto, MediaSourceType, PlayerStateInfo } from '@jellyfin/sdk/lib/generated-client/index';

interface PlaybackState {
    PlayState: PlayerStateInfo,
    NowPlayingItem?: BaseItemDto,
    MediaSource: MediaSourceType
}

/**
 * Video player page component that renders mui controls for the top controls and the legacy view for everything else.
 */
const VideoPage: FC = () => {
    const documentRef = useRef<Document>(document);
    const [ isVisible, setIsVisible ] = useState(true);

    const onShowVideoOsd = (_e: Event, isShowing: boolean) => {
        setIsVisible(isShowing);
    };

    useEffect(() => {
        const doc = documentRef.current;

        if (doc) Events.on(doc, EventType.SHOW_VIDEO_OSD, onShowVideoOsd);

        return () => {
            if (doc) Events.off(doc, EventType.SHOW_VIDEO_OSD, onShowVideoOsd);
        };
    }, []);

    const [ playbackState, setPlaybackState ] = useState<PlaybackState>();

    useEffect(() => {
        const player = playbackManager.getCurrentPlayer();
        if (!player) return;
        const state = playbackManager.getPlayerState(player);
        setPlaybackState(state);
    }, []);

    return (
        <>
            <Fade
                in={isVisible}
                easing='fade-out'
            >
                <Box sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    color: 'white'
                }}>
                    <AppToolbar
                        isDrawerAvailable={false}
                        isDrawerOpen={false}
                        isBackButtonAvailable
                        isUserMenuAvailable={false}
                        buttons={<SyncPlayButton />}
                    >
                        {
                            playbackState && <div
                                style={{ marginLeft: '1em', display: 'flex', gap: '1em' }}
                            >
                                {
                                    playbackState.NowPlayingItem?.Type === 'Episode' && <span>
                                        S{playbackState.NowPlayingItem?.ParentIndexNumber}:E{playbackState.NowPlayingItem?.IndexNumber}
                                    </span>
                                }
                                {playbackState.NowPlayingItem?.Name && <span>{playbackState.NowPlayingItem?.Name}</span>}
                            </div>
                        }
                    </AppToolbar>
                </Box>
            </Fade>

            <ViewManagerPage
                controller='playback/video/index'
                view='playback/video/index.html'
                type='video-osd'
                isFullscreen
                isNowPlayingBarEnabled={false}
                isThemeMediaSupported
            />
        </>
    );
};

export default VideoPage;
