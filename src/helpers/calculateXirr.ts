/* tslint:disable */
import differenceInDays from "date-fns/differenceInDays";

function newtonRaphson(fx: any, fdx: any, guess: any) {
    let precision = 4;
    let errorLimit = Math.pow(10, -1 * precision);
    let previousValue = 0;
    let iteration = 0;

    do {
        guess = Number(guess);
        previousValue = Number(guess);
        guess = previousValue - Number(fx(guess)) / Number(fdx(guess));
        if (++iteration >= 100) {
            throw new Error("newtonRaphson failed to converge");
        }
    } while (Math.abs(guess - previousValue) > errorLimit);

    return guess;
}

function pow(a: number, b: number) {
    if (b < 1 && a < 0) {
        return -Math.pow(-a, b);
    } else {
        return Math.pow(a, b);
    }
}

function calculateXirr(transactions: { amount: number; when: Date }[], guess = 0.1) {
    const startDate = transactions[0].when;
    const values = transactions.map((t: any) => t.amount);
    const days = transactions.map((t: any) => differenceInDays(t.when, startDate));

    const fx = function(x: any) {
        let sum = 0;

        days.forEach(function(day: any, idx: any) {
            sum += values[idx] * pow(1 + x, (days[0] - day) / 365);
        });

        return sum;
    };

    const fdx = function(x: any) {
        let sum = 0;

        days.forEach(function(day: any, idx: any) {
            sum += (1 / 365) * (days[0] - day) * values[idx] * pow(1 + x, (days[0] - day) / 365 - 1);
        });

        return sum;
    };

    return newtonRaphson(fx, fdx, guess);
}

export default calculateXirr;
