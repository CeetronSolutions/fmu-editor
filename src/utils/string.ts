export const capitalize = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};

export const uncapitalize = (str: string) => {
    return str.charAt(0).toLowerCase() + str.slice(1);
};
