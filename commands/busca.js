const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'busca',
    description: 'Busca Pokémon en las listas.',
    async execute(client, message, args, { whitelistPublic, whitelistPrivate, paginationStates, generatePaginationButtons }) {
        const searchTerm = args.join(' ').toLowerCase();
        if (!searchTerm) {
            return message.reply('❌ Proporciona un término de búsqueda.');
        }

        const pokemonList = [
            ...[...whitelistPublic].map(p => ({ name: p, type: 'Pública' })),
            ...[...whitelistPrivate].map(p => ({ name: p, type: 'Privada' }))
        ].filter(p => p.name.toLowerCase().includes(searchTerm))
        .sort((a, b) => a.name.localeCompare(b.name));

        if (pokemonList.length === 0) {
            return message.reply(`🔍 No se encontraron resultados para "${searchTerm}"`);
        }

        const itemsPerPage = 25;
        const totalPages = Math.ceil(pokemonList.length / itemsPerPage);

        const generateEmbed = (currentPage) => {
            const start = currentPage * itemsPerPage;
            const end = start + itemsPerPage;
            const currentItems = pokemonList.slice(start, end);
            
            let description = currentItems.map((item, index) => 
                `${start + index + 1}. ${item.name} (${item.type})`
            ).join('\n');

            return new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`🔍 Resultados para "${searchTerm}" (${pokemonList.length})`)
                .setDescription(description || '`No hay resultados`')
                .setFooter({ text: `Página ${currentPage + 1} de ${totalPages}` });
        };

        const initialState = { 
            currentPage: 0,
            pokemonList,
            itemsPerPage,
            totalPages,
            searchTerm,
            messageAuthorId: message.author.id,
            commandName: 'busca',
            customPrefix: 'busca_'
        };
        const reply = await message.reply({
            embeds: [generateEmbed(initialState.currentPage)],
            components: [generatePaginationButtons(initialState.currentPage, totalPages, 'busca_')],
            fetchReply: true
        });

        paginationStates.set(reply.id, initialState);
    },
    handlePagination: async (interaction, state, generatePaginationButtons) => {
        if (interaction.customId.includes('_close_list')) return interaction.message.delete().catch(() => {});
        if (interaction.user.id !== state.messageAuthorId) {
            return interaction.reply({
                content: '❌ Solo el autor del comando puede interactuar con esta paginación.',
                ephemeral: true
            });
        }

        if (interaction.customId === 'busca_prev_page' && state.currentPage > 0) {
            state.currentPage--;
        } else if (interaction.customId === 'busca_next_page' && state.currentPage < state.totalPages - 1) {
            state.currentPage++;
        } else if (interaction.customId === 'busca_close_list') {
            paginationStates.delete(interaction.message.id);
            return interaction.message.delete().catch(() => interaction.update({ components: [] }));
        }

        const start = state.currentPage * state.itemsPerPage;
        const end = start + state.itemsPerPage;
        const currentItems = state.pokemonList.slice(start, end);

        const description = currentItems.map((item, index) =>
            `${start + index + 1}. ${item.name} (${item.type})`
        ).join('\n');

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`🔍 Resultados para "${state.searchTerm}" (${state.pokemonList.length})`)
            .setDescription(description || '`No hay resultados`')
            .setFooter({ text: `Página ${state.currentPage + 1} de ${state.totalPages}` });

        await interaction.update({
            embeds: [embed],
            components: [generatePaginationButtons(state.currentPage, state.totalPages, 'busca_')]
        });
    }
};