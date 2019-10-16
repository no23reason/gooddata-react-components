// (C) 2019 GoodData Corporation
import cloneDeep = require("lodash/cloneDeep");
import get = require("lodash/get");
import * as React from "react";
import { render, unmountComponentAtNode } from "react-dom";
import { InjectedIntl } from "react-intl";
import { AFM, VisualizationObject } from "@gooddata/typings";
import produce from "immer";
import { configurePercent, configureOverTimeComparison } from "../../../utils/bucketConfig";
import UnsupportedConfigurationPanel from "../../configurationPanels/UnsupportedConfigurationPanel";

import * as VisEvents from "../../../../interfaces/Events";
import * as BucketNames from "../../../../constants/bucketNames";
import {
    IReferencePoint,
    IExtendedReferencePoint,
    IVisCallbacks,
    IVisConstruct,
    IVisProps,
    ILocale,
    IVisualizationProperties,
    IBucketItem,
    IBucket,
} from "../../../interfaces/Visualization";

import { ATTRIBUTE, DATE, METRIC } from "../../../constants/bucket";

import {
    sanitizeUnusedFilters,
    getAllItemsByType,
    getTotalsFromBucket,
    getItemsFromBuckets,
    removeDuplicateBucketItems,
} from "../../../utils/bucketHelper";

import { createInternalIntl } from "../../../utils/internalIntlProvider";
import { DEFAULT_XIRR_UICONFIG } from "../../../constants/uiConfig";
import { AbstractPluggableVisualization } from "../AbstractPluggableVisualization";
import { getReferencePointWithSupportedProperties } from "../../../utils/propertiesHelper";
import { VisualizationTypes } from "../../../../constants/visualizationTypes";
import { generateDimensions } from "../../../../helpers/dimensions";
import { DEFAULT_LOCALE } from "../../../../constants/localization";
import { Xirr } from "../../../../components/core/Xirr";
import { setXirrUiConfig } from "../../../utils/uiConfigHelpers/xirrUiConfigHelper";

export const getColumnAttributes = (buckets: IBucket[]): IBucketItem[] => {
    return getItemsFromBuckets(
        buckets,
        [BucketNames.COLUMNS, BucketNames.STACK, BucketNames.SEGMENT],
        [ATTRIBUTE, DATE],
    );
};

export const getRowAttributes = (buckets: IBucket[]): IBucketItem[] => {
    return getItemsFromBuckets(
        buckets,
        [BucketNames.ATTRIBUTE, BucketNames.ATTRIBUTES, BucketNames.VIEW, BucketNames.TREND],
        [ATTRIBUTE, DATE],
    );
};

export class PluggableXirr extends AbstractPluggableVisualization {
    private projectId: string;
    private element: string;
    private configPanelElement: string;
    private callbacks: IVisCallbacks;
    private intl: InjectedIntl;
    private visualizationProperties: IVisualizationProperties;
    private locale: ILocale;

    constructor(props: IVisConstruct) {
        super();
        this.projectId = props.projectId;
        this.element = props.element;
        this.configPanelElement = props.configPanelElement;
        this.callbacks = props.callbacks;
        this.locale = props.locale ? props.locale : DEFAULT_LOCALE;
        this.intl = createInternalIntl(this.locale);
        this.onExportReady = props.callbacks.onExportReady && this.onExportReady.bind(this);
    }

    public unmount() {
        unmountComponentAtNode(document.querySelector(this.element));
        if (document.querySelector(this.configPanelElement)) {
            unmountComponentAtNode(document.querySelector(this.configPanelElement));
        }
    }

    public update(
        options: IVisProps,
        visualizationProperties: IVisualizationProperties,
        mdObject: VisualizationObject.IVisualizationObjectContent,
    ) {
        this.visualizationProperties = visualizationProperties;
        this.renderVisualization(options, visualizationProperties, mdObject);
        this.renderConfigurationPanel();
    }

    public getExtendedReferencePoint(referencePoint: IReferencePoint): Promise<IExtendedReferencePoint> {
        return Promise.resolve(
            produce<IExtendedReferencePoint>(
                referencePoint as IExtendedReferencePoint,
                referencePointDraft => {
                    referencePointDraft.uiConfig = cloneDeep(DEFAULT_XIRR_UICONFIG);

                    const buckets = referencePointDraft.buckets;
                    const measures = getAllItemsByType(buckets, [METRIC]);
                    const rowAttributes = getRowAttributes(buckets);

                    const columnAttributes = getColumnAttributes(buckets);

                    const totals = getTotalsFromBucket(buckets, BucketNames.ATTRIBUTE);

                    // const totals: VisualizationObject.IVisualizationTotal[] =
                    //     measures[0] && columnAttributes[0]
                    //         ? [
                    //               {
                    //                   measureIdentifier: measures[0].localIdentifier,
                    //                   attributeIdentifier: columnAttributes[0].localIdentifier,
                    //                   type: "sum",
                    //               },
                    //           ]
                    //         : [];

                    referencePointDraft.buckets = removeDuplicateBucketItems([
                        {
                            localIdentifier: BucketNames.MEASURES,
                            items: measures,
                        },
                        {
                            localIdentifier: BucketNames.ATTRIBUTE,
                            items: rowAttributes,
                            // This is needed because at the beginning totals property is
                            // missing from buckets. If we would pass empty array or
                            // totals: undefined, reference points would differ.
                            ...(totals.length > 0 ? { totals } : null),
                        },
                        {
                            localIdentifier: BucketNames.COLUMNS,
                            items: columnAttributes,
                        },
                    ]);

                    referencePointDraft.properties = {};

                    setXirrUiConfig(referencePointDraft, this.intl, VisualizationTypes.TABLE);
                    configurePercent(referencePointDraft, false);
                    configureOverTimeComparison(referencePointDraft);
                    Object.assign(
                        referencePointDraft,
                        getReferencePointWithSupportedProperties(
                            referencePointDraft,
                            this.supportedPropertiesList,
                        ),
                    );
                    referencePointDraft.filters = sanitizeUnusedFilters(
                        referencePointDraft,
                        referencePoint,
                    ).filters;
                },
            ),
        );
    }

    protected renderVisualization(
        options: IVisProps,
        _visualizationProperties: IVisualizationProperties,
        mdObject: VisualizationObject.IVisualizationObjectContent,
    ) {
        const { dataSource } = options;

        if (dataSource) {
            const { resultSpec, locale, custom, dimensions, config } = options;
            const { height } = dimensions;
            const { drillableItems } = custom;
            const { afterRender, onError, onLoadingChanged, pushData } = this.callbacks;

            const resultSpecWithDimensions: AFM.IResultSpec = {
                ...resultSpec,
                dimensions: this.getDimensions(mdObject),
            };

            const rowsBucket = mdObject.buckets.find(
                bucket => bucket.localIdentifier === BucketNames.ATTRIBUTE,
            );
            const totals: VisualizationObject.IVisualizationTotal[] = (rowsBucket && rowsBucket.totals) || [];

            const pivotTableProps = {
                projectId: this.projectId,
                drillableItems,
                totals,
                config,
                height,
                locale,
                dataSource,
                resultSpec: resultSpecWithDimensions,
                afterRender,
                onLoadingChanged,
                pushData,
                onError,
                onExportReady: this.onExportReady,
                intl: this.intl,
            };
            render(<Xirr {...pivotTableProps} />, document.querySelector(this.element));
        }
    }

    protected onExportReady(exportResult: VisEvents.IExportFunction) {
        const { onExportReady } = this.callbacks;
        if (onExportReady) {
            onExportReady(exportResult);
        }
    }

    protected renderConfigurationPanel() {
        if (document.querySelector(this.configPanelElement)) {
            const properties: IVisualizationProperties = get(
                this.visualizationProperties,
                "properties",
                {},
            ) as IVisualizationProperties;

            render(
                <UnsupportedConfigurationPanel
                    locale={this.locale}
                    pushData={this.callbacks.pushData}
                    properties={properties}
                />,
                document.querySelector(this.configPanelElement),
            );
        }
    }

    protected getDimensions(mdObject: VisualizationObject.IVisualizationObjectContent): AFM.IDimension[] {
        return generateDimensions(mdObject, VisualizationTypes.TABLE);
    }
}
