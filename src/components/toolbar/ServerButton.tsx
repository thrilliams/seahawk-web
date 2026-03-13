import banner from "../../branding/banner-light.png";
import Button from "@mui/material/Button/Button";
import React, { FC } from "react";
import { Link } from "react-router-dom";

const ServerButton: FC = () => (
    <Button variant="text" size="large" color="inherit" component={Link} to="/">
        <img
            src={banner}
            alt=""
            aria-hidden
            style={{
                maxHeight: "1.25em",
            }}
        />
    </Button>
);

export default ServerButton;
