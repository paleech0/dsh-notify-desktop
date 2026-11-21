/** The translator the card needs (string keys keep the catalogue decoupled). */
type Translate = (key: string, params?: Record<string, string>) => string;
/**
 * The external-push channel manager.
 * @param props - the plugin translator.
 * @returns the rendered card body.
 */
export declare function ChannelManager(props: {
    readonly t: Translate;
}): JSX.Element;
export {};
