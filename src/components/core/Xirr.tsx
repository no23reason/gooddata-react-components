// (C) 2007-2018 GoodData Corporation
import * as React from "react";
import { IntlWrapper } from "./base/IntlWrapper";
import { IntlTranslationsProvider, ITranslationsComponentProps } from "./base/TranslationsProvider";
import { HeadlinePropTypes, Requireable } from "../../proptypes/Headline";
import { IDataSourceProviderInjectedProps } from "../afm/DataSourceProvider";
import {
    ICommonVisualizationProps,
    visualizationLoadingHOC,
    ILoadingInjectedProps,
    commonDefaultProps,
} from "./base/VisualizationLoadingHOC";
import { BaseVisualization } from "./base/BaseVisualization";
import parse from "date-fns/parse";
import calculateXirr from "../../helpers/calculateXirr";
import range = require("lodash/range");
import Headline from "../visualizations/headline/Headline";
import { Execution } from "@gooddata/typings";

export { Requireable };

export class XirrStateless extends BaseVisualization<
    ICommonVisualizationProps & ILoadingInjectedProps & IDataSourceProviderInjectedProps,
    {}
> {
    public static defaultProps: Partial<ICommonVisualizationProps> = commonDefaultProps;

    public static propTypes = HeadlinePropTypes;

    protected renderVisualization(): JSX.Element {
        const { locale } = this.props;

        const xirr = this.computeXirr();

        return (
            <IntlWrapper locale={locale}>
                <IntlTranslationsProvider>
                    {(_props: ITranslationsComponentProps) => {
                        console.log("222", this.props.execution, xirr);

                        return (
                            <Headline
                                data={{
                                    primaryItem: {
                                        localIdentifier: "xirr",
                                        value: xirr && xirr.toString(),
                                    },
                                }}
                            />
                        );
                    }}
                </IntlTranslationsProvider>
            </IntlWrapper>
        );
    }

    private computeXirr = (): number => {
        if (!(this.props.execution && this.props.execution.executionResult)) {
            return null;
        }
        const totals = this.props.execution.executionResult.totals[0][0] as any;
        const dates = this.props.execution.executionResult.headerItems[1][0].map(
            (h: Execution.IResultAttributeHeaderItem) => h.attributeHeaderItem.name,
        );

        const transactions = range(totals.length).map(i => ({
            amount: Number.parseFloat(totals[i]),
            when: parse(dates[i], "MMM y", new Date()),
        }));

        return calculateXirr(transactions);
    };
}

export const Xirr = visualizationLoadingHOC(XirrStateless);
