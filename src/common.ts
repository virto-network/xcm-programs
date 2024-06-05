import { u8aToHex, hexToU8a } from "@polkadot/util";
import { isAddress, decodeAddress } from "@polkadot/util-crypto";

function makePre(template: TemplateStringsArray, ...params: any[]) {
  let strings = structuredClone(template.raw) as string[];
  let pre = "";
  while (strings.length + params.length > 0) {
    let param = params.shift() ?? "";
    if (typeof param === "object" && param.length) {
      param = u8aToHex(param);
    }
    if (typeof param === "string" && isAddress(param)) {
      param = u8aToHex(decodeAddress(param));
    }

    pre = `${pre}${strings.shift()}${param}`;
  }

  return pre;
}

function parsePlurality(inner: string) {
  const { body, bodyId, part, partId } =
    /(?<body>(?<bodyId>\w*)(?:\(.*\))?),(?<part>(?<partId>\w*)(?:\(.*\))?)/.exec(
      inner
    ).groups!;

  let pluralityId;
  switch (bodyId) {
    case "Unit":
    case "Executive":
    case "Technical":
    case "Legislative":
    case "Judicial":
    case "Defense":
      pluralityId = bodyId;
    case "Moniker":
      let { moniker } = /Moniker\((?<moniker>0x\w*)\)/.exec(body).groups!;
      pluralityId = {
        Moniker: hexToU8a(moniker),
      };
      break;
    case "Index":
      let { index } = /Index\((?<index>\d*)\)/.exec(body).groups!;
      pluralityId = {
        Index: Number(index),
      };
      break;
  }

  let pluralityPart;
  switch (partId) {
    case "Voice":
      pluralityPart = "Voice";
      break;
    case "Members":
      let { members } = /Members\((?<members>\d*)\)/.exec(part).groups!;
      pluralityId = {
        Members: { count: Number(members) },
      };
      break;
    case "Fraction": {
      let { nom, denom } = /Fraction\((?<nom>\d*),\s?(?<denom>\d*)\)/.exec(part)
        .groups!;
      pluralityPart = {
        Fraction: { nom: Number(nom), denom: Number(denom) },
      };
      break;
    }
    case "AtLeastProportion": {
      let { nom, denom } =
        /AtLeastProportion\((?<nom>\d*),\s?(?<denom>\d*)\)/.exec(part).groups!;
      pluralityPart = {
        AtLeastProportion: { nom: Number(nom), denom: Number(denom) },
      };
      break;
    }
    case "MoreThanProportion": {
      let { nom, denom } =
        /MoreThanProportion\((?<nom>\d*),\s?(?<denom>\d*)\)/.exec(part).groups!;
      pluralityPart = {
        MoreThanProportion: { nom: Number(nom), denom: Number(denom) },
      };
      break;
    }
  }

  return {
    id: pluralityId,
    part: pluralityPart,
  };
}

function makeInterior(segments: string[]) {
  const junctions = segments.map((segment) => {
    let { type, inner } = /(?<type>\w*)(?:\((?<inner>.*)\))?/.exec(segment)
      .groups!;

    switch (type) {
      case "Here":
        return "Here";
      case "Parachain":
        return { Parachain: Number(inner) };
      case "AccountId32":
        console.log(type, inner);
        let { network = null, id } = /(?<network>\w*,)?(?<id>0x.*)/.exec(inner)
          .groups!;
        return {
          AccountId32: {
            network,
            id: hexToU8a(id),
          },
        };
      case "Plurality":
        return { Plurality: parsePlurality(inner) };
    }
  });

  return junctions.length === 1 && junctions[0] === "Here"
    ? "Here"
    : {
        [`X${junctions.length}`]: junctions,
      };
}

export function interior(template: TemplateStringsArray, ...params: any[]) {
  const pre = makePre(template, ...params);
  return makeInterior(pre.split("/"));
}

export function location(template: TemplateStringsArray, ...params: any[]) {
  const pre = makePre(template, ...params);

  const segments = pre.split("/");
  let parents = 0;
  while (segments.length) {
    const head = segments.shift();
    if (head == "..") {
      parents += 1;
    } else if (head === ".") {
    } else {
      segments.unshift(head);
      break;
    }
  }

  return {
    parents,
    interior: makeInterior(segments),
  };
}

export function makeAccountId32(id: string) {
  return {
    AccountId32: {
      network: null,
      id,
    },
  };
}

export function fungibleAsset(id: unknown, amount: number) {
  return {
    id,
    fun: { Fungible: amount },
  };
}
export function concreteIdfungibleAsset(id: unknown, amount: number) {
  return {
    id: { Concrete: id },
    fun: { Fungible: amount },
  };
}
